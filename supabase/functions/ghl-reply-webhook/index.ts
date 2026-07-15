// ghl-reply-webhook -- automatic response attribution, no human clicks.
//
// A GHL workflow ("Dispo Reply Tracker": trigger Customer Replied -> Webhook
// action) POSTs here when a contact replies. We find the most recent campaign
// that contact was sent (last 30 days), stamp responded_at on their recipient
// row, and add them to that deal's buyer interest tracker (source 'campaign')
// so the deal's Buyers tab reflects who raised their hand -- automatically.
//
// Auth: no JWT (GHL can't sign one). Guarded by a shared secret instead:
// the webhook URL carries ?secret=<app_settings.GHL_WEBHOOK_SECRET>.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Shared-secret check (query param or header)
    const url = new URL(req.url);
    const supplied = url.searchParams.get("secret") || req.headers.get("x-webhook-secret") || "";
    const { data: secretRow } = await admin
      .from("app_settings").select("value").eq("key", "GHL_WEBHOOK_SECRET").maybeSingle();
    if (!secretRow?.value || supplied !== secretRow.value) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({} as any));
    // GHL workflow webhooks vary in shape; accept the common contact-id spots.
    const contactId: string | null =
      body?.contact_id ?? body?.contactId ?? body?.contact?.id ?? body?.customData?.contact_id ?? body?.id ?? null;
    if (!contactId) return json({ ok: false, reason: "no contact id in payload" });

    const { data: buyer } = await admin
      .from("dispo_buyers").select("id").eq("ghl_contact_id", contactId).maybeSingle();
    if (!buyer) return json({ ok: true, attributed: false, reason: "not a tracked buyer" });

    // Most recent campaign send to this buyer (30-day window), not yet marked.
    const { data: recRows } = await admin
      .from("dispo_campaign_recipients")
      .select("id, campaign_id, sent_at")
      .eq("buyer_id", buyer.id)
      .eq("status", "sent")
      .is("responded_at", null)
      .gte("sent_at", new Date(Date.now() - 30 * 86400000).toISOString())
      .order("sent_at", { ascending: false })
      .limit(1);
    const rec = (recRows ?? [])[0];
    if (!rec) return json({ ok: true, attributed: false, reason: "no recent campaign send" });

    await admin
      .from("dispo_campaign_recipients")
      .update({ responded_at: new Date().toISOString() })
      .eq("id", rec.id);

    // Put the buyer on the deal's interest tracker if they aren't already.
    const { data: campaign } = await admin
      .from("dispo_campaigns").select("transaction_id").eq("id", rec.campaign_id).maybeSingle();
    if (campaign?.transaction_id) {
      const { data: existing } = await admin
        .from("dispo_deal_interests")
        .select("id")
        .eq("transaction_id", campaign.transaction_id)
        .eq("buyer_id", buyer.id)
        .maybeSingle();
      if (!existing) {
        await admin.from("dispo_deal_interests").insert({
          transaction_id: campaign.transaction_id,
          buyer_id: buyer.id,
          level: "interested",
          source: "campaign",
        });
      }
    }

    return json({ ok: true, attributed: true });
  } catch (e: any) {
    console.error("ghl-reply-webhook error", e);
    return json({ error: String(e?.message ?? e) }, 500);
  }
});

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
