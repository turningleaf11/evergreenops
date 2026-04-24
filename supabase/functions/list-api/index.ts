// Public REST API for a specific list (database).
// Auth: Authorization: Bearer <api_key>
// Routes:
//   GET    /list-api/:databaseId/rows
//   POST   /list-api/:databaseId/rows
//   GET    /list-api/:databaseId/rows/:rowId
//   PATCH  /list-api/:databaseId/rows/:rowId
//   DELETE /list-api/:databaseId/rows/:rowId
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

declare const EdgeRuntime: { waitUntil: (p: Promise<unknown>) => void };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// naive in-memory rate limit per key (per cold-start)
const buckets = new Map<string, { count: number; resetAt: number }>();
function rateLimit(id: string, limit = 60, windowMs = 60_000) {
  const now = Date.now();
  const b = buckets.get(id);
  if (!b || b.resetAt < now) {
    buckets.set(id, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (b.count >= limit) return false;
  b.count++;
  return true;
}

async function dispatchEvent(supabase: any, databaseId: string, event: string, row: any) {
  // Fire-and-forget: enumerate active outbound webhooks and POST to each.
  const { data: hooks } = await supabase
    .from("database_webhooks")
    .select("*")
    .eq("database_id", databaseId)
    .eq("direction", "out")
    .eq("active", true);
  for (const h of hooks || []) {
    if (!h.events?.includes(event) || !h.url) continue;
    const payload = { event, database_id: databaseId, row, ts: new Date().toISOString() };
    const body = JSON.stringify(payload);
    const sig = await hmac(h.secret, body);
    try {
      const resp = await fetch(h.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Lovable-Signature": sig, "X-Lovable-Event": event },
        body,
      });
      const txt = (await resp.text()).slice(0, 500);
      await supabase.from("database_webhook_deliveries").insert({
        webhook_id: h.id, event, status_code: resp.status, response_excerpt: txt, payload,
      });
      await supabase.from("database_webhooks").update({
        last_status: resp.status, last_delivered_at: new Date().toISOString(),
      }).eq("id", h.id);
    } catch (e) {
      await supabase.from("database_webhook_deliveries").insert({
        webhook_id: h.id, event, status_code: 0, response_excerpt: String(e).slice(0, 500), payload,
      });
    }
  }
}

async function hmac(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    // Path looks like /list-api/<databaseId>/rows[/<rowId>]
    const parts = url.pathname.replace(/^\/+/, "").split("/").filter(Boolean);
    // parts[0] === "list-api"
    const databaseId = parts[1];
    const segment = parts[2];
    const rowId = parts[3];

    if (!databaseId || segment !== "rows") {
      return json({ error: "Invalid path. Expected /list-api/{databaseId}/rows[/{rowId}]" }, 400);
    }

    const auth = req.headers.get("authorization") || "";
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (!m) return json({ error: "Missing Bearer token" }, 401);
    const token = m[1].trim();

    if (!rateLimit(token)) return json({ error: "Rate limit exceeded" }, 429);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const tokenHash = await sha256(token);
    const { data: keyRow } = await supabase
      .from("database_api_keys")
      .select("id, database_id, workspace_id, revoked_at")
      .eq("key_hash", tokenHash)
      .maybeSingle();

    if (!keyRow || keyRow.revoked_at || keyRow.database_id !== databaseId) {
      return json({ error: "Invalid API key for this list" }, 401);
    }

    if (req.method === "GET" && !rowId) {
      const limit = Math.min(parseInt(url.searchParams.get("limit") || "100"), 500);
      const { data, error } = await supabase
        .from("database_rows")
        .select("id, values, created_at, updated_at")
        .eq("database_id", databaseId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) return json({ error: error.message }, 500);
      return json({ rows: data });
    }

    if (req.method === "GET" && rowId) {
      const { data, error } = await supabase
        .from("database_rows")
        .select("id, values, created_at, updated_at")
        .eq("database_id", databaseId).eq("id", rowId).maybeSingle();
      if (error) return json({ error: error.message }, 500);
      if (!data) return json({ error: "Not found" }, 404);
      return json({ row: data });
    }

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const values = body?.values && typeof body.values === "object" ? body.values : body;
      if (!values || typeof values !== "object") return json({ error: "Body must be an object or { values: {...} }" }, 400);
      const { data, error } = await supabase
        .from("database_rows")
        .insert({ database_id: databaseId, values })
        .select("id, values, created_at, updated_at").single();
      if (error) return json({ error: error.message }, 500);
      EdgeRuntime.waitUntil(dispatchEvent(supabase, databaseId, "row.created", data));
      return json({ row: data }, 201);
    }

    if (req.method === "PATCH" && rowId) {
      const body = await req.json().catch(() => ({}));
      const values = body?.values && typeof body.values === "object" ? body.values : body;
      const { data: existing } = await supabase
        .from("database_rows").select("values").eq("id", rowId).eq("database_id", databaseId).maybeSingle();
      if (!existing) return json({ error: "Not found" }, 404);
      const merged = { ...(existing.values as any), ...values };
      const { data, error } = await supabase
        .from("database_rows").update({ values: merged }).eq("id", rowId)
        .select("id, values, created_at, updated_at").single();
      if (error) return json({ error: error.message }, 500);
      EdgeRuntime.waitUntil(dispatchEvent(supabase, databaseId, "row.updated", data));
      return json({ row: data });
    }

    if (req.method === "DELETE" && rowId) {
      const { data, error } = await supabase
        .from("database_rows").delete().eq("id", rowId).eq("database_id", databaseId)
        .select("id, values").single();
      if (error) return json({ error: error.message }, 500);
      EdgeRuntime.waitUntil(dispatchEvent(supabase, databaseId, "row.deleted", data));
      return json({ ok: true, row: data });
    }

    return json({ error: "Method not allowed for this path" }, 405);
  } catch (e) {
    return json({ error: String((e as any)?.message || e) }, 500);
  }
});
