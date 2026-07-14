// send-campaign -- sends one batch of a dispo campaign's pending recipients via
// GHL (email or SMS), then reports how many remain so the client loops until 0.
//
// OpsHQ decides (audience, copy, timing); GHL delivers. The client first creates
// a dispo_campaigns row + dispo_campaign_recipients (status 'pending'), then
// calls this repeatedly with { campaign_id } until remaining === 0.
//
// Opt-outs are respected: no email without email_opt_in, no SMS without sms_opt_in.
// Auth: JWT + admin, matching the other OpsHQ GHL functions.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BATCH = 75; // stay well under GHL burst limits

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Auth: signed-in admin only
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: "Unauthorized" }, 401);
    const { data: roleRow } = await userClient
      .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) return json({ error: "Admin only" }, 403);

    const { campaign_id } = await req.json().catch(() => ({}));
    if (!campaign_id) return json({ error: "campaign_id is required" }, 400);

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: settings } = await admin
      .from("app_settings").select("key, value").in("key", ["GHL_API_KEY", "GHL_LOCATION_ID"]);
    const cfg: Record<string, string> = {};
    (settings ?? []).forEach((s: any) => { cfg[s.key] = s.value; });
    const apiKey = cfg.GHL_API_KEY || Deno.env.get("GHL_API_KEY");
    if (!apiKey) return json({ error: "GHL not configured (GHL_API_KEY)" }, 400);

    const { data: campaign, error: cErr } = await admin
      .from("dispo_campaigns").select("*").eq("id", campaign_id).single();
    if (cErr || !campaign) return json({ error: "Campaign not found" }, 404);

    await admin.from("dispo_campaigns").update({ status: "sending" }).eq("id", campaign_id);

    // Pending recipients for this batch, joined to their buyer (client-side join
    // -- no reliance on a PostgREST FK embed).
    const { data: recs } = await admin
      .from("dispo_campaign_recipients")
      .select("id, buyer_id")
      .eq("campaign_id", campaign_id)
      .eq("status", "pending")
      .limit(BATCH);
    const recipients = recs ?? [];
    const buyerIds = recipients.map((r: any) => r.buyer_id);
    const buyerById = new Map<string, any>();
    if (buyerIds.length) {
      const { data: buyers } = await admin
        .from("dispo_buyers")
        .select("id, ghl_contact_id, first_name, email, phone, email_opt_in, sms_opt_in")
        .in("id", buyerIds);
      (buyers ?? []).forEach((b: any) => buyerById.set(b.id, b));
    }

    const channel = String(campaign.channel || "email").toLowerCase();
    let sent = 0, failed = 0;

    for (const r of recipients as any[]) {
      const buyer = buyerById.get(r.buyer_id);
      const mark = (status: string, error?: string) =>
        admin.from("dispo_campaign_recipients").update({
          status,
          error: error || null,
          sent_at: status === "sent" ? new Date().toISOString() : null,
        }).eq("id", r.id);

      try {
        if (!buyer || !buyer.ghl_contact_id) { await mark("skipped", "No GHL contact"); continue; }
        if (channel === "email" && (!buyer.email || !buyer.email_opt_in)) { await mark("skipped", "No email / opted out"); continue; }
        if (channel === "sms" && (!buyer.phone || !buyer.sms_opt_in)) { await mark("skipped", "No phone / opted out"); continue; }

        const firstName = (buyer.first_name as string)?.trim() || "there";
        const personalize = (t: string) => (t || "").replace(/\{\{\s*first_name\s*\}\}/gi, firstName);

        const payload = channel === "email"
          ? { type: "Email", contactId: buyer.ghl_contact_id, subject: personalize(campaign.subject || "New deal"), html: personalize(campaign.body).replace(/\n/g, "<br/>") }
          : { type: "SMS", contactId: buyer.ghl_contact_id, message: personalize(campaign.body) };

        const res = await fetch("https://services.leadconnectorhq.com/conversations/messages", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, Version: "2021-07-28", "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(`GHL ${res.status}: ${(await res.text()).slice(0, 200)}`);

        await mark("sent");
        sent++;
        await new Promise((r) => setTimeout(r, 120)); // burst-limit friendly
      } catch (e) {
        failed++;
        await mark("failed", e instanceof Error ? e.message : "Unknown error");
      }
    }

    const { count: remaining } = await admin
      .from("dispo_campaign_recipients")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaign_id)
      .eq("status", "pending");

    await admin.from("dispo_campaigns").update({
      sent_count: (campaign.sent_count || 0) + sent,
      failed_count: (campaign.failed_count || 0) + failed,
      status: (remaining || 0) > 0 ? "sending" : "sent",
      completed_at: (remaining || 0) > 0 ? null : new Date().toISOString(),
    }).eq("id", campaign_id);

    return json({ sent, failed, remaining: remaining || 0 });
  } catch (e: any) {
    console.error("send-campaign error", e);
    return json({ error: String(e?.message ?? e) }, 500);
  }
});

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
