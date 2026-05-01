// Inbound webhook for leads: HMAC-signed POST creates a lead row.
// POST /lead-webhook-in/<slug>
// Header: X-Lovable-Signature = HMAC-SHA256(secret, raw body) hex
import {
  corsHeaders, json, admin, hmacHex, rateLimit, mapPayloadToLead,
  recordSubmission, emitActivity, getClientIp,
} from "../_shared/lead-intake.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  try {
    const url = new URL(req.url);
    const parts = url.pathname.replace(/^\/+/, "").split("/").filter(Boolean);
    const slug = parts[parts.length - 1];
    if (!slug) return json({ error: "Missing webhook slug" }, 400);

    if (!rateLimit(`webhook:${slug}`, 120)) {
      return json({ error: "Rate limit exceeded" }, 429);
    }

    const supabase = admin();
    const { data: source } = await supabase
      .from("lead_intake_sources")
      .select("id, workspace_id, name, kind, active, secret, default_source_label")
      .eq("slug", slug)
      .maybeSingle();

    if (!source || source.kind !== "webhook" || !source.active) {
      return json({ error: "Webhook not found" }, 404);
    }

    const raw = await req.text();
    const sig = req.headers.get("x-lovable-signature") || "";
    const expected = await hmacHex(source.secret, raw);
    if (!sig || sig !== expected) {
      return json({ error: "Invalid signature" }, 401);
    }

    let body: any = {};
    try { body = JSON.parse(raw || "{}"); } catch {
      return json({ error: "Invalid JSON" }, 400);
    }

    const ip = getClientIp(req);
    const ua = req.headers.get("user-agent");
    const sourceLabel = source.default_source_label ?? `Webhook: ${source.name}`;

    const { row, rejected } = mapPayloadToLead(body, source.workspace_id, sourceLabel);

    if (rejected) {
      await recordSubmission(supabase, {
        sourceId: source.id, workspaceId: source.workspace_id, leadId: null,
        payload: body, ip, userAgent: ua, status: "rejected", error: rejected,
      });
      return json({ error: rejected }, 400);
    }

    const { data: lead, error: insertErr } = await supabase
      .from("leads")
      .insert(row)
      .select("id, name")
      .single();

    if (insertErr || !lead) {
      await recordSubmission(supabase, {
        sourceId: source.id, workspaceId: source.workspace_id, leadId: null,
        payload: body, ip, userAgent: ua, status: "error", error: insertErr?.message ?? "insert failed",
      });
      return json({ error: insertErr?.message ?? "Could not create lead" }, 500);
    }

    await recordSubmission(supabase, {
      sourceId: source.id, workspaceId: source.workspace_id, leadId: lead.id,
      payload: body, ip, userAgent: ua, status: "ok",
    });

    await emitActivity(supabase, {
      leadId: lead.id, leadName: lead.name, sourceName: sourceLabel,
    });

    return json({ ok: true, lead: { id: lead.id, name: lead.name } }, 201);
  } catch (e) {
    return json({ error: String((e as any)?.message || e) }, 500);
  }
});
