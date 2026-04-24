// Public list-form endpoint.
// GET  /list-form/{slug}  -> form metadata + list column types (only if active + visibility=public)
// POST /list-form/{slug}  -> insert a row, fire row.created webhook
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const buckets = new Map<string, { count: number; resetAt: number }>();
function rateLimit(id: string, limit = 30) {
  const now = Date.now();
  const b = buckets.get(id);
  if (!b || b.resetAt < now) { buckets.set(id, { count: 1, resetAt: now + 60_000 }); return true; }
  if (b.count >= limit) return false;
  b.count++; return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const parts = url.pathname.replace(/^\/+/, "").split("/").filter(Boolean);
    const slug = parts[1];
    if (!slug) return json({ error: "Missing form slug" }, 400);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: form } = await supabase
      .from("database_forms")
      .select("id, database_id, workspace_id, slug, title, description, visibility, fields, submit_message, is_active")
      .eq("slug", slug)
      .maybeSingle();

    if (!form || !form.is_active || form.visibility !== "public") return json({ error: "Form not found" }, 404);

    const { data: meta } = await supabase
      .from("databases_meta")
      .select("id, title, columns")
      .eq("id", form.database_id)
      .maybeSingle();
    if (!meta) return json({ error: "List not found" }, 404);

    const columnsById: Record<string, any> = Object.fromEntries((meta.columns as any[] || []).map(c => [c.id, c]));

    if (req.method === "GET") {
      const fields = (form.fields as any[] || []).map(f => {
        const col = columnsById[f.column_id];
        return col ? {
          column_id: f.column_id,
          name: col.name,
          type: col.type,
          options: col.options || null,
          label: f.label || col.name,
          help_text: f.help_text || "",
          required: !!f.required,
        } : null;
      }).filter(Boolean);
      return json({
        title: form.title,
        description: form.description,
        submit_message: form.submit_message,
        fields,
      });
    }

    if (req.method === "POST") {
      if (!rateLimit(slug)) return json({ error: "Too many submissions, try again shortly" }, 429);
      let body: any = {};
      try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
      const submitted = body?.values && typeof body.values === "object" ? body.values : {};
      const values: Record<string, any> = {};
      for (const f of (form.fields as any[] || [])) {
        const col = columnsById[f.column_id];
        if (!col) continue;
        const v = submitted[f.column_id];
        if (f.required && (v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0))) {
          return json({ error: `${f.label || col.name} is required` }, 400);
        }
        if (v !== undefined) values[f.column_id] = v;
      }

      const { data: inserted, error } = await supabase
        .from("database_rows")
        .insert({ database_id: form.database_id, values })
        .select("id, values, created_at")
        .single();
      if (error) return json({ error: error.message }, 500);

      // Fire outbound webhooks (best-effort, don't block response)
      try {
        const fnBase = (Deno.env.get("SUPABASE_URL") || "").replace(".supabase.co", ".functions.supabase.co");
        // simpler: use functions url shape
        const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/list-webhook-dispatch`;
        await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({ database_id: form.database_id, event: "row.created", row: inserted }),
        }).catch(() => {});
      } catch { /* ignore */ }

      return json({ ok: true, message: form.submit_message }, 201);
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (e) {
    return json({ error: String((e as any)?.message || e) }, 500);
  }
});
