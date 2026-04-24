// Internal dispatcher: called from the app when a row is created/updated/deleted.
// Body: { database_id: string, event: 'row.created'|'row.updated'|'row.deleted', row: any }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function hmac(secret: string, message: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  try {
    const auth = req.headers.get("authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } });
    const { data: claims } = await userClient.auth.getClaims(auth.replace("Bearer ", ""));
    if (!claims?.claims) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const { database_id, event, row, webhook_id } = body || {};
    if (!database_id || !event) return json({ error: "Missing database_id or event" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    let q = admin.from("database_webhooks").select("*").eq("database_id", database_id).eq("direction", "out").eq("active", true);
    if (webhook_id) q = admin.from("database_webhooks").select("*").eq("id", webhook_id);
    const { data: hooks } = await q;

    const results: any[] = [];
    for (const h of hooks || []) {
      if (!webhook_id && (!h.events?.includes(event) || !h.url)) continue;
      const payload = { event, database_id, row, ts: new Date().toISOString() };
      const text = JSON.stringify(payload);
      const sig = await hmac(h.secret, text);
      try {
        const resp = await fetch(h.url, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Lovable-Signature": sig, "X-Lovable-Event": event },
          body: text,
        });
        const r = (await resp.text()).slice(0, 500);
        await admin.from("database_webhook_deliveries").insert({
          webhook_id: h.id, event, status_code: resp.status, response_excerpt: r, payload,
        });
        await admin.from("database_webhooks").update({
          last_status: resp.status, last_delivered_at: new Date().toISOString(),
        }).eq("id", h.id);
        results.push({ id: h.id, status: resp.status });
      } catch (e) {
        await admin.from("database_webhook_deliveries").insert({
          webhook_id: h.id, event, status_code: 0, response_excerpt: String(e).slice(0, 500), payload,
        });
        results.push({ id: h.id, error: String(e) });
      }
    }
    return json({ ok: true, dispatched: results });
  } catch (e) {
    return json({ error: String((e as any)?.message || e) }, 500);
  }
});
