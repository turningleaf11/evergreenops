// event-ingest -- public endpoint for external systems (Zapier zap failures,
// webhooks, monitors) to post an event into the OpsHQ feed/inbox. Auth is a
// shared secret in app_settings (EVENT_INGEST_SECRET), sent as x-ingest-secret.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-ingest-secret",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: secretRow } = await admin.from("app_settings").select("value").eq("key", "EVENT_INGEST_SECRET").maybeSingle();
    const secret = secretRow?.value;
    const provided = req.headers.get("x-ingest-secret") || new URL(req.url).searchParams.get("secret");
    if (!secret || provided !== secret) return json({ error: "Unauthorized" }, 401);

    const b = await req.json().catch(() => ({}));
    const title = (b.title || "").toString().trim();
    if (!title) return json({ error: "title required" }, 400);

    const severity = ["info", "success", "warning", "error"].includes(b.severity) ? b.severity : "warning";

    const { data, error } = await admin.from("events").insert({
      type: (b.type || "external").toString(),
      severity,
      title: title.slice(0, 300),
      body: b.body ? b.body.toString().slice(0, 2000) : null,
      source: (b.source || "zapier").toString(),
      entity_label: b.entity_label ? b.entity_label.toString().slice(0, 200) : null,
      actor: b.actor ? b.actor.toString().slice(0, 200) : null,
      needs_action: b.needs_action === undefined ? true : !!b.needs_action,
      metadata: b.metadata ?? null,
    }).select("id").single();
    if (error) return json({ error: error.message }, 500);

    return json({ ok: true, id: data.id });
  } catch (e) {
    console.error("event-ingest error", e);
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});
