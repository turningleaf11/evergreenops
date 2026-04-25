// Sandbox endpoint — same auth & validation as api-ingest, but never writes.
// Returns "wouldExecute" / "wouldInsertOrUpdate" for inspection.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const READABLE = new Set([
  "contacts", "companies", "deals", "leads", "pipelines", "pipeline_stages",
  "tasks", "reminders", "projects", "goals", "issues",
  "posts", "announcements", "polls", "kudos",
  "documents", "notes", "crm_activities",
  "profiles", "departments", "scorecard_entries", "scorecard_metrics",
]);

const WRITABLE = new Set([
  "contacts", "leads", "deals", "tasks", "reminders",
  "posts", "crm_activities", "form_submissions", "issues",
]);

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function validatePayload(p: any): string | null {
  if (!p || typeof p !== "object") return "Body must be a JSON object";
  if (typeof p.resource !== "string") return "`resource` is required";
  if (!["list", "get", "create", "update"].includes(p.action)) {
    return "`action` must be one of: list, get, create, update";
  }
  if ((p.action === "get" || p.action === "update") && !p.id) {
    return "`id` is required for get/update";
  }
  if ((p.action === "create" || p.action === "update") && (!p.data || typeof p.data !== "object")) {
    return "`data` object is required for create/update";
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (req.method === "GET") {
    return json({ ok: true, endpoint: "api-test (dry-run)", hint: "POST a payload to validate it." });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const auth = req.headers.get("Authorization") || "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match) return json({ error: "Missing Authorization: Bearer <token>" }, 401);

  const hash = await sha256Hex(match[1].trim());
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const { data: tok, error: tokErr } = await supabase
    .from("api_tokens")
    .select("id, workspace_id, revoked_at, name")
    .eq("token_hash", hash)
    .maybeSingle();
  if (tokErr || !tok) return json({ error: "Invalid token" }, 401);
  if (tok.revoked_at) return json({ error: "Token has been revoked" }, 401);

  let payload: any;
  try { payload = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }

  const validationError = validatePayload(payload);
  if (validationError) return json({ ok: false, error: validationError }, 400);

  const { resource, action, id, data = {}, filters = {}, limit = 50 } = payload;
  const isWrite = action === "create" || action === "update";

  if ((action === "list" || action === "get") && !READABLE.has(resource)) {
    return json({ ok: false, error: `Resource '${resource}' is not readable via API` }, 403);
  }
  if (isWrite && !WRITABLE.has(resource)) {
    return json({ ok: false, error: `Resource '${resource}' is not writable via API` }, 403);
  }

  const preview: Record<string, unknown> = {
    ok: true,
    mode: "dry-run",
    authenticatedAs: tok.name,
    workspaceId: tok.workspace_id,
    wouldExecute: { resource, action, id, filters, limit },
  };
  if (isWrite) {
    preview.wouldInsertOrUpdate = { ...data, workspace_id: tok.workspace_id };
  }
  return json(preview);
});
