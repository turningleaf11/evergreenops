// enroll-campaign -- Option C, webhook-data flavor: OpsHQ decides, GHL delivers.
//
// For each pending recipient, OpsHQ POSTs the campaign's (already personalized)
// copy as JSON to the channel's GHL "Inbound Webhook" workflow. The workflow
// matches the contact by email/phone and maps the payload fields straight into
// its Send Email / Send SMS actions -- no contact custom fields, no write scope.
// The copy is transactional, so it never touches the contact record.
//
// Payload posted per recipient:
//   { contact_id, email, phone, first_name, subject, body, campaign_id }
// Map in the workflow: Subject <- {{inboundWebhookRequest.subject}},
//   Body/Message <- {{inboundWebhookRequest.body}}. Match contact on email/phone.
//
// Batch contract matches the composer loop: call with { campaign_id } until
// remaining === 0. Opt-outs skipped here; GHL DND applies at send too.
// Requires app_settings: GHL_DISPO_EMAIL_WEBHOOK_URL / GHL_DISPO_SMS_WEBHOOK_URL.
// Auth: JWT + admin.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BATCH = 75;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

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
      .from("app_settings").select("key, value").in("key", ["GHL_DISPO_EMAIL_WEBHOOK_URL", "GHL_DISPO_SMS_WEBHOOK_URL"]);
    const cfg: Record<string, string> = {};
    (settings ?? []).forEach((s: any) => { cfg[s.key] = s.value; });

    const { data: campaign, error: cErr } = await admin
      .from("dispo_campaigns").select("*").eq("id", campaign_id).single();
    if (cErr || !campaign) return json({ error: "Campaign not found" }, 404);

    const channel = String(campaign.channel || "email").toLowerCase();
    const webhookUrl = channel === "sms" ? cfg.GHL_DISPO_SMS_WEBHOOK_URL : cfg.GHL_DISPO_EMAIL_WEBHOOK_URL;
    if (!webhookUrl) {
      return json({
        error: `No ${channel} blast webhook configured. In GHL add an "Inbound Webhook" trigger to your Dispo Blast ${channel === "sms" ? "SMS" : "Email"} workflow, then save its URL as app_settings.${channel === "sms" ? "GHL_DISPO_SMS_WEBHOOK_URL" : "GHL_DISPO_EMAIL_WEBHOOK_URL"}.`,
      }, 400);
    }

    await admin.from("dispo_campaigns").update({ status: "sending" }).eq("id", campaign_id);

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
        if (!buyer) { await mark("skipped", "Buyer missing"); continue; }
        if (channel === "email" && (!buyer.email || !buyer.email_opt_in)) { await mark("skipped", "No email / opted out"); continue; }
        if (channel === "sms" && (!buyer.phone || !buyer.sms_opt_in)) { await mark("skipped", "No phone / opted out"); continue; }

        const firstName = (buyer.first_name as string)?.trim() || "there";
        const personalize = (t: string) => (t || "").replace(/\{\{\s*first_name\s*\}\}/gi, firstName);

        const payload = {
          contact_id: buyer.ghl_contact_id ?? null,
          email: buyer.email ?? null,
          phone: buyer.phone ?? null,
          first_name: firstName,
          subject: channel === "email" ? personalize(campaign.subject || "New deal") : null,
          body: personalize(campaign.body),
          campaign_id,
        };

        const res = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(`Webhook ${res.status}: ${(await res.text()).slice(0, 160)}`);

        await mark("sent");
        sent++;
        await new Promise((res) => setTimeout(res, 100));
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
    console.error("enroll-campaign error", e);
    return json({ error: String(e?.message ?? e) }, 500);
  }
});

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
