// Public API for the workspace.
// Auth: Authorization: Bearer <token> (token issued via Settings → API)
// Scope: read on all tables (RLS-bypassed, scoped to the token's workspace);
//        write limited to a safe subset of resources.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

// Tables the API may READ from (most things)
const READABLE = new Set([
  "contacts", "companies", "deals", "leads", "pipelines", "pipeline_stages",
  "tasks", "reminders", "projects", "goals", "issues",
  "posts", "announcements", "polls", "kudos",
  "documents", "notes", "crm_activities",
  "profiles", "departments", "scorecard_entries", "scorecard_metrics",
]);

// Tables the API may WRITE to (safe inbound subset)
const WRITABLE = new Set([
  "contacts", "leads", "deals", "tasks", "reminders",
  "posts", "crm_activities", "form_submissions", "issues",
]);

type Action = "list" | "get" | "create" | "update";

interface Payload {
  resource: string;
  action: Action;
  id?: string;
  data?: Record<string, unknown>;
  filters?: Record<string, unknown>;
  limit?: number;
  dryRun?: boolean;
}

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

async function authenticate(req: Request) {
  const auth = req.headers.get("Authorization") || "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match) return { error: "Missing Authorization: Bearer <token>" as const };

  const raw = match[1].trim();
  const hash = await sha256Hex(raw);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const { data, error } = await supabase
    .from("api_tokens")
    .select("id, workspace_id, revoked_at, name")
    .eq("token_hash", hash)
    .maybeSingle();

  if (error || !data) return { error: "Invalid token" as const };
  if (data.revoked_at) return { error: "Token has been revoked" as const };

  // Touch (best-effort)
  try { await supabase.rpc("api_token_touch", { _token_id: data.id }); } catch { /* best effort */ }

  return { supabase, workspaceId: data.workspace_id as string, tokenName: data.name as string };
}

export default async function handler(req: Request, isTest = false): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (req.method === "GET") {
    return json({
      ok: true,
      endpoint: isTest ? "api-test (dry-run)" : "api-ingest",
      hint: "POST with JSON body. See docs in Settings → API.",
    });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const auth = await authenticate(req);
  if ("error" in auth) return json({ error: auth.error }, 401);

  let payload: Payload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const validationError = validatePayload(payload);
  if (validationError) return json({ ok: false, error: validationError }, 400);

  const { resource, action, id, data = {}, filters = {}, limit = 50 } = payload;
  const isWrite = action === "create" || action === "update";

  if (action === "list" || action === "get") {
    if (!READABLE.has(resource)) {
      return json({ ok: false, error: `Resource '${resource}' is not readable via API` }, 403);
    }
  }
  if (isWrite && !WRITABLE.has(resource)) {
    return json({ ok: false, error: `Resource '${resource}' is not writable via API` }, 403);
  }

  // Dry-run: just echo what we *would* do
  if (isTest || payload.dryRun) {
    const preview: Record<string, unknown> = {
      ok: true,
      mode: "dry-run",
      authenticatedAs: auth.tokenName,
      workspaceId: auth.workspaceId,
      wouldExecute: { resource, action, id, filters, limit },
    };
    if (isWrite) {
      preview.wouldInsertOrUpdate = { ...data, workspace_id: auth.workspaceId };
    }
    return json(preview);
  }

  // Real execution
  const sb = auth.supabase;
  try {
    if (action === "list") {
      let q = sb.from(resource).select("*").eq("workspace_id", auth.workspaceId).limit(Math.min(limit, 200));
      for (const [k, v] of Object.entries(filters)) q = q.eq(k, v as any);
      const { data: rows, error } = await q;
      if (error) throw error;
      return json({ ok: true, count: rows?.length ?? 0, data: rows });
    }

    if (action === "get") {
      const { data: row, error } = await sb
        .from(resource)
        .select("*")
        .eq("workspace_id", auth.workspaceId)
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      if (!row) return json({ ok: false, error: "Not found" }, 404);
      return json({ ok: true, data: row });
    }

    if (action === "create") {
      const insertData = { ...data, workspace_id: auth.workspaceId };
      const { data: row, error } = await sb.from(resource).insert(insertData).select().maybeSingle();
      if (error) throw error;
      return json({ ok: true, data: row }, 201);
    }

    if (action === "update") {
      const { data: row, error } = await sb
        .from(resource)
        .update(data)
        .eq("workspace_id", auth.workspaceId)
        .eq("id", id!)
        .select()
        .maybeSingle();
      if (error) throw error;
      if (!row) return json({ ok: false, error: "Not found or not in workspace" }, 404);
      return json({ ok: true, data: row });
    }
  } catch (e: any) {
    return json({ ok: false, error: e?.message || "Database error", details: e }, 400);
  }

  return json({ ok: false, error: "Unhandled action" }, 400);
}

Deno.serve((req) => handler(req, false));
