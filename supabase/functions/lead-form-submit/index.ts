// Public form endpoint: accepts a lead submission via slug. No auth required.
// POST /lead-form-submit/<slug>  body: { values: {...} } or { ...fields }
import {
  corsHeaders, json, admin, rateLimit, mapPayloadToLead,
  recordSubmission, emitActivity, getClientIp,
} from "../_shared/lead-intake.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  try {
    const url = new URL(req.url);
    const parts = url.pathname.replace(/^\/+/, "").split("/").filter(Boolean);
    const slug = parts[parts.length - 1];
    if (!slug) return json({ error: "Missing form slug in URL" }, 400);

    const ip = getClientIp(req);
    const ua = req.headers.get("user-agent");

    if (!rateLimit(`form:${slug}:${ip ?? "anon"}`, 30)) {
      return json({ error: "Too many submissions, please slow down." }, 429);
    }

    const supabase = admin();

    const { data: source } = await supabase
      .from("lead_intake_sources")
      .select("id, workspace_id, name, kind, active, default_source_label")
      .eq("slug", slug)
      .maybeSingle();

    if (!source || source.kind !== "form" || !source.active) {
      return json({ error: "Form not found" }, 404);
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    // Honeypot
    if (body && typeof body === "object" && (body.hp_company || body.values?.hp_company)) {
      await recordSubmission(supabase, {
        sourceId: source.id, workspaceId: source.workspace_id, leadId: null,
        payload: { honeypot: true }, ip, userAgent: ua, status: "rejected", error: "honeypot",
      });
      return json({ ok: true }); // pretend success
    }

    const sourceLabel = source.default_source_label ?? `Form: ${source.name}`;
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

    return json({ ok: true, lead_id: lead.id });
  } catch (e) {
    return json({ error: String((e as any)?.message || e) }, 500);
  }
});
