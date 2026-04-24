// Public inbound webhook: external systems POST a row payload here.
// URL: /list-webhook-in/<webhook_id>
// Auth: header X-Lovable-Signature = HMAC-SHA256(secret, raw body) hex
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-lovable-signature",
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

const buckets = new Map<string, { count: number; resetAt: number }>();
function rateLimit(id: string, limit = 60) {
  const now = Date.now();
  const b = buckets.get(id);
  if (!b || b.resetAt < now) { buckets.set(id, { count: 1, resetAt: now + 60_000 }); return true; }
  if (b.count >= limit) return false;
  b.count++; return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  try {
    const url = new URL(req.url);
    const parts = url.pathname.replace(/^\/+/, "").split("/").filter(Boolean);
    const webhookId = parts[1];
    if (!webhookId) return json({ error: "Missing webhook id in path" }, 400);
    if (!rateLimit(webhookId)) return json({ error: "Rate limit exceeded" }, 429);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: hook } = await supabase.from("database_webhooks")
      .select("id, database_id, secret, direction, active").eq("id", webhookId).maybeSingle();
    if (!hook || hook.direction !== "in" || !hook.active) return json({ error: "Webhook not found" }, 404);

    const raw = await req.text();
    const sig = req.headers.get("x-lovable-signature") || "";
    const expected = await hmac(hook.secret, raw);
    if (sig !== expected) return json({ error: "Invalid signature" }, 401);

    let body: any = {};
    try { body = JSON.parse(raw || "{}"); } catch { return json({ error: "Invalid JSON" }, 400); }
    const values = body?.values && typeof body.values === "object" ? body.values : body;
    if (!values || typeof values !== "object") return json({ error: "Body must be an object" }, 400);

    const { data, error } = await supabase.from("database_rows")
      .insert({ database_id: hook.database_id, values })
      .select("id, values, created_at").single();
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true, row: data }, 201);
  } catch (e) {
    return json({ error: String((e as any)?.message || e) }, 500);
  }
});
