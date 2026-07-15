// enroll-campaign -- Option C execution: OpsHQ decides, GHL delivers.
//
// For each pending recipient of a dispo campaign: stamp the buyer's GHL contact
// with the campaign's merged copy (Dispo Email Subject / Dispo Email Body /
// Dispo SMS Body / Dispo Campaign ID custom fields), then enroll the contact in
// the matching GHL workflow ("Dispo Blast -- Email" / "Dispo Blast -- SMS").
// The workflow does the actual sending with GHL's native infra (throttling,
// unsubscribe/DND, replies) and can run follow-up steps.
//
// Batch contract matches send-campaign: call repeatedly with { campaign_id }
// until remaining === 0. Opt-outs are skipped here as well (belt & suspenders --
// GHL DND also applies at send time).
//
// Requires app_settings: GHL_API_KEY (with contacts.write scope),
// GHL_LOCATION_ID, GHL_DISPO_EMAIL_WORKFLOW_ID, GHL_DISPO_SMS_WORKFLOW_ID.
// Auth: JWT + admin, matching the other OpsHQ GHL functions.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BATCH = 50;

// GHL custom fields the blast workflows read. Resolved by fieldKey, with a
// name fallback in case GHL generated a different key when created manually.
const MERGE_FIELDS = {
  emailSubject: { key: "contact.dispo_email_subject", name: "Dispo Email Subject" },
  emailBody: { key: "contact.dispo_email_body", name: "Dispo Email Body" },
  smsBody: { key: "contact.dispo_sms_body", name: "Dispo SMS Body" },
  campaignId: { key: "contact.dispo_campaign_id", name: "Dispo Campaign ID" },
} as const;

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
      .from("app_settings").select("key, value")
      .in("key", ["GHL_API_KEY", "GHL_LOCATION_ID", "GHL_DISPO_EMAIL_WORKFLOW_ID", "GHL_DISPO_SMS_WORKFLOW_ID"]);
    const cfg: Record<string, string> = {};
    (settings ?? []).forEach((s: any) => { cfg[s.key] = s.value; });
    const apiKey = cfg.GHL_API_KEY || Deno.env.get("GHL_API_KEY");
    const locationId = cfg.GHL_LOCATION_ID || Deno.env.get("GHL_LOCATION_ID");
    if (!apiKey || !locationId) return json({ error: "GHL not configured (GHL_API_KEY / GHL_LOCATION_ID)" }, 400);

    const { data: campaign, error: cErr } = await admin
      .from("dispo_campaigns").select("*").eq("id", campaign_id).single();
    if (cErr || !campaign) return json({ error: "Campaign not found" }, 404);

    const channel = String(campaign.channel || "email").toLowerCase();
    const workflowId = channel === "sms" ? cfg.GHL_DISPO_SMS_WORKFLOW_ID : cfg.GHL_DISPO_EMAIL_WORKFLOW_ID;
    if (!workflowId) {
      return json({
        error: `No ${channel} blast workflow configured. Build the "Dispo Blast -- ${channel === "sms" ? "SMS" : "Email"}" workflow in GHL and save its ID as app_settings.${channel === "sms" ? "GHL_DISPO_SMS_WORKFLOW_ID" : "GHL_DISPO_EMAIL_WORKFLOW_ID"}.`,
      }, 400);
    }

    const ghl = (path: string, init: RequestInit = {}) =>
      fetch(`https://services.leadconnectorhq.com${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Version: "2021-07-28",
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(init.headers || {}),
        },
      });

    // Resolve merge-field IDs once (by fieldKey, falling back to display name).
    const cfRes = await ghl(`/locations/${encodeURIComponent(locationId)}/customFields`);
    if (!cfRes.ok) return json({ error: `GHL customFields ${cfRes.status}`, detail: (await cfRes.text()).slice(0, 300) }, 502);
    const cfData = await cfRes.json();
    const allFields = (cfData.customFields || cfData.fields || []) as any[];
    const idFor: Record<string, string> = {};
    for (const [alias, f] of Object.entries(MERGE_FIELDS)) {
      const hit = allFields.find(
        (x) =>
          (x.fieldKey || "").toLowerCase() === f.key.toLowerCase() ||
          (x.name || "").trim().toLowerCase() === f.name.toLowerCase(),
      );
      if (hit?.id) idFor[alias] = hit.id;
    }
    const needed = channel === "sms" ? ["smsBody", "campaignId"] : ["emailSubject", "emailBody", "campaignId"];
    const missing = needed.filter((k) => !idFor[k]);
    if (missing.length) {
      return json({
        error: `Missing GHL custom fields: ${missing.map((k) => MERGE_FIELDS[k as keyof typeof MERGE_FIELDS].name).join(", ")}. Create them in GHL (Settings -> Custom Fields) exactly as named in the dispo workflow spec.`,
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
        if (!buyer || !buyer.ghl_contact_id) { await mark("skipped", "No GHL contact"); continue; }
        if (channel === "email" && (!buyer.email || !buyer.email_opt_in)) { await mark("skipped", "No email / opted out"); continue; }
        if (channel === "sms" && (!buyer.phone || !buyer.sms_opt_in)) { await mark("skipped", "No phone / opted out"); continue; }

        const firstName = (buyer.first_name as string)?.trim() || "there";
        const personalize = (t: string) => (t || "").replace(/\{\{\s*first_name\s*\}\}/gi, firstName);

        const customFields =
          channel === "sms"
            ? [
                { id: idFor.smsBody, field_value: personalize(campaign.body) },
                { id: idFor.campaignId, field_value: campaign_id },
              ]
            : [
                { id: idFor.emailSubject, field_value: personalize(campaign.subject || "New deal") },
                { id: idFor.emailBody, field_value: personalize(campaign.body).replace(/\n/g, "<br/>") },
                { id: idFor.campaignId, field_value: campaign_id },
              ];

        // 1) Stamp the merged copy onto the contact
        const upRes = await ghl(`/contacts/${buyer.ghl_contact_id}`, {
          method: "PUT",
          body: JSON.stringify({ customFields }),
        });
        if (!upRes.ok) throw new Error(`GHL contact update ${upRes.status}: ${(await upRes.text()).slice(0, 200)}`);

        // 2) Enroll in the blast workflow -- GHL takes it from here
        const wfRes = await ghl(`/contacts/${buyer.ghl_contact_id}/workflow/${workflowId}`, {
          method: "POST",
          body: JSON.stringify({}),
        });
        if (!wfRes.ok) throw new Error(`GHL workflow enroll ${wfRes.status}: ${(await wfRes.text()).slice(0, 200)}`);

        await mark("sent");
        sent++;
        await new Promise((res) => setTimeout(res, 150)); // 2 calls/recipient; stay under burst limits
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
