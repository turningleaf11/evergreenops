// process-site-leads -- the write-back loop for the public inventory site.
//
// Site forms capture leads into dispo_site_leads (see evergreen-dispo-site). This
// function enriches each one, OpsHQ-side:
//   1. Upserts the person into GoHighLevel (contact + tag + a note with the
//      details) -- GHL is the system of record for people, and the tag lets
//      their intake workflows fire.
//   2. Upserts the person into dispo_buyers (source 'signup') so they appear in
//      OpsHQ immediately; the next ghl-sync refines the structured buy-box.
//   3. For a property inquiry, attributes it to the deal as a dispo_deal_interest
//      (source 'landing_page') so it lands in that deal's Buyers tab.
//
// Auth: verify_jwt (called by the site's service-role client, or manually).
// Idempotent: pass { id } to process one lead, or nothing to sweep all pending.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GHL_BASE = "https://services.leadconnectorhq.com";
const MAX_ATTEMPTS = 5;

interface Lead {
  id: string;
  kind: "inquiry" | "buyers_list";
  deal_slug: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  offer_price: number | null;
  message: string | null;
  buy_box: Record<string, unknown> | null;
  attempts: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    let onlyId: string | null = null;
    try {
      const body = await req.json();
      if (typeof body?.id === "string") onlyId = body.id;
    } catch { /* no body -> sweep */ }

    // GHL config lives in app_settings (same as the other OpsHQ GHL functions).
    const { data: settings } = await admin
      .from("app_settings")
      .select("key, value")
      .in("key", ["GHL_API_KEY", "GHL_LOCATION_ID", "GHL_SITE_INQUIRY_TAG", "GHL_SITE_BUYERS_TAG"]);
    const cfg: Record<string, string> = {};
    (settings ?? []).forEach((s: any) => { cfg[s.key] = s.value; });
    const apiKey = cfg.GHL_API_KEY || Deno.env.get("GHL_API_KEY");
    const locationId = cfg.GHL_LOCATION_ID || Deno.env.get("GHL_LOCATION_ID");
    if (!apiKey || !locationId) return json({ error: "GHL not configured (GHL_API_KEY / GHL_LOCATION_ID)" }, 400);
    const inquiryTag = (cfg.GHL_SITE_INQUIRY_TAG || "website deal inquiry").toLowerCase();
    const buyersTag = (cfg.GHL_SITE_BUYERS_TAG || "website buyers list").toLowerCase();

    let q = admin
      .from("dispo_site_leads")
      .select("id, kind, deal_slug, first_name, last_name, email, phone, offer_price, message, buy_box, attempts")
      .eq("processed", false)
      .lt("attempts", MAX_ATTEMPTS)
      .order("created_at", { ascending: true })
      .limit(50);
    if (onlyId) q = q.eq("id", onlyId);
    const { data: leads, error: leadErr } = await q;
    if (leadErr) return json({ error: leadErr.message }, 500);

    let processed = 0, failed = 0;

    for (const lead of (leads as Lead[]) ?? []) {
      try {
        // Inquiry: resolve the deal (for the note + attribution).
        let dealTitle: string | null = null;
        let txId: string | null = null;
        if (lead.kind === "inquiry" && lead.deal_slug) {
          const { data: tx } = await admin
            .from("crm_transactions")
            .select("id, marketing_title, property_city, property_state")
            .eq("slug", lead.deal_slug)
            .maybeSingle();
          if (tx) {
            txId = tx.id as string;
            dealTitle = (tx.marketing_title as string) ||
              [tx.property_city, tx.property_state].filter(Boolean).join(", ") || lead.deal_slug;
          }
        }

        // 1. Upsert the GHL contact (create or match by email/phone) + tag.
        const tags = lead.kind === "inquiry" ? [inquiryTag] : [buyersTag];
        const contactId = await ghlUpsertContact(apiKey, locationId, lead, tags);

        // 2. Attach a note with everything captured (best-effort).
        await ghlAddNote(apiKey, contactId, noteFor(lead, dealTitle));

        // 3. Upsert into dispo_buyers so they show in OpsHQ now.
        const { data: buyer, error: bErr } = await admin
          .from("dispo_buyers")
          .upsert(
            {
              ghl_contact_id: contactId,
              first_name: lead.first_name || "",
              last_name: lead.last_name || "",
              email: lead.email,
              phone: lead.phone,
              source: "signup",
              status: "active",
              email_opt_in: lead.kind === "buyers_list",
              buy_box_notes: buyBoxNotes(lead),
              updated_at: new Date().toISOString(),
            },
            { onConflict: "ghl_contact_id" },
          )
          .select("id")
          .single();
        if (bErr) throw new Error(`buyer upsert: ${bErr.message}`);

        // 4. Inquiry -> attribute interest on the deal.
        if (txId && buyer?.id) {
          const { error: iErr } = await admin
            .from("dispo_deal_interests")
            .upsert(
              {
                transaction_id: txId,
                buyer_id: buyer.id,
                level: lead.offer_price != null ? "offer" : "interested",
                offer_amount: lead.offer_price,
                source: "landing_page",
                notes: lead.message,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "transaction_id,buyer_id" },
            );
          if (iErr) throw new Error(`interest upsert: ${iErr.message}`);
        }

        await admin
          .from("dispo_site_leads")
          .update({ processed: true, processed_at: new Date().toISOString(), error: null })
          .eq("id", lead.id);

        // Ping the feed/inbox.
        const who = [lead.first_name, lead.last_name].filter(Boolean).join(" ") || lead.email || "Someone";
        if (lead.kind === "inquiry") {
          await admin.from("events").insert({
            type: "site_inquiry",
            severity: "info",
            title: lead.offer_price != null
              ? `${who} offered $${Number(lead.offer_price).toLocaleString()} on ${dealTitle ?? "a listing"}`
              : `${who} inquired on ${dealTitle ?? "a listing"}`,
            body: lead.message ?? null,
            source: "site", entity_type: "deal", entity_id: txId, entity_label: dealTitle,
            actor: who, needs_action: true, metadata: { lead_id: lead.id, offer: lead.offer_price },
          });
        } else {
          await admin.from("events").insert({
            type: "buyers_list_signup",
            severity: "info",
            title: `${who} joined the buyers list`,
            source: "site", entity_type: "buyer", entity_id: buyer?.id ?? null, entity_label: who,
            actor: who, needs_action: false, metadata: { lead_id: lead.id, buy_box: lead.buy_box },
          });
        }
        processed++;
      } catch (e: any) {
        failed++;
        await admin
          .from("dispo_site_leads")
          .update({ attempts: (lead.attempts ?? 0) + 1, error: String(e?.message ?? e).slice(0, 500) })
          .eq("id", lead.id);
        await admin.from("events").insert({
          type: "lead_error", severity: "error", source: "site", needs_action: true,
          title: "Website lead failed to process",
          body: String(e?.message ?? e).slice(0, 300),
          metadata: { lead_id: lead.id },
        }).then(() => {}, () => {});
        console.error("process-site-leads lead", lead.id, e);
      }
    }

    return json({ processed, failed });
  } catch (e: any) {
    console.error("process-site-leads error", e);
    return json({ error: String(e?.message ?? e) }, 500);
  }
});

async function ghlUpsertContact(
  apiKey: string,
  locationId: string,
  lead: Lead,
  tags: string[],
): Promise<string> {
  const res = await fetch(`${GHL_BASE}/contacts/upsert`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Version: "2021-07-28",
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      locationId,
      firstName: lead.first_name || undefined,
      lastName: lead.last_name || undefined,
      email: lead.email || undefined,
      phone: lead.phone || undefined,
      tags,
      source: "Website",
    }),
  });
  if (!res.ok) throw new Error(`GHL upsert ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const id = data?.contact?.id ?? data?.id;
  if (!id) throw new Error("GHL upsert returned no contact id");
  return id as string;
}

async function ghlAddNote(apiKey: string, contactId: string, body: string): Promise<void> {
  try {
    await fetch(`${GHL_BASE}/contacts/${contactId}/notes`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Version: "2021-07-28",
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ body }),
    });
  } catch (e) {
    console.error("ghlAddNote", e); // notes are best-effort
  }
}

function buyBoxNotes(lead: Lead): string | null {
  if (lead.kind === "buyers_list") {
    const bb = (lead.buy_box ?? {}) as Record<string, unknown>;
    const parts = [
      bb.states ? `States: ${bb.states}` : null,
      bb.strategy ? `Strategy: ${bb.strategy}` : null,
      bb.price_range ? `Price: ${bb.price_range}` : null,
    ].filter(Boolean);
    return parts.length ? parts.join(" | ") : (lead.message || null);
  }
  return lead.message || null;
}

function noteFor(lead: Lead, dealTitle: string | null): string {
  const who = [lead.first_name, lead.last_name].filter(Boolean).join(" ") || lead.email || "Website lead";
  if (lead.kind === "inquiry") {
    const lines = [
      `Website inquiry from ${who}${dealTitle ? ` on "${dealTitle}"` : ""}.`,
      lead.offer_price != null ? `Offer: $${Number(lead.offer_price).toLocaleString()}` : null,
      lead.phone ? `Phone: ${lead.phone}` : null,
      lead.message ? `Message: ${lead.message}` : null,
    ];
    return lines.filter(Boolean).join("\n");
  }
  const bb = (lead.buy_box ?? {}) as Record<string, unknown>;
  const lines = [
    `Joined the buyers list via website: ${who}.`,
    bb.states ? `States: ${bb.states}` : null,
    bb.strategy ? `Strategy: ${bb.strategy}` : null,
    bb.price_range ? `Price range: ${bb.price_range}` : null,
    lead.message ? `Notes: ${lead.message}` : null,
  ];
  return lines.filter(Boolean).join("\n");
}

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
