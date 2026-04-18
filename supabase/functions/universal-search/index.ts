// Universal search across people, docs, notes, tasks, projects, goals, database records.
// Returns a normalized list for use in @mention pickers and global search.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Hit {
  id: string;
  type: "person" | "doc" | "note" | "task" | "project" | "goal" | "record";
  title: string;
  subtitle?: string;
  url: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim();
    const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "8"), 20);

    const like = q ? `%${q}%` : "%";

    const [people, docs, notes, tasks, projects, goals, records] = await Promise.all([
      supabase.from("profiles").select("user_id, full_name, email").ilike("full_name", like).limit(limit),
      supabase.from("documents").select("id, title").ilike("title", like).limit(limit),
      supabase.from("notes").select("id, title").ilike("title", like).limit(limit),
      supabase.from("tasks").select("id, title").ilike("title", like).limit(limit),
      supabase.from("projects").select("id, title").ilike("title", like).limit(limit),
      supabase.from("goals").select("id, title").ilike("title", like).limit(limit),
      supabase.from("databases_meta").select("id, title").ilike("title", like).limit(limit),
    ]);

    const hits: Hit[] = [];
    (people.data ?? []).forEach((p: any) => hits.push({
      id: p.user_id, type: "person", title: p.full_name || p.email || "Unknown", subtitle: p.email ?? undefined, url: `/people?u=${p.user_id}`,
    }));
    (docs.data ?? []).forEach((d: any) => hits.push({ id: d.id, type: "doc", title: d.title, url: `/docs?id=${d.id}` }));
    (notes.data ?? []).forEach((n: any) => hits.push({ id: n.id, type: "note", title: n.title || "Untitled", url: `/notes?id=${n.id}` }));
    (tasks.data ?? []).forEach((t: any) => hits.push({ id: t.id, type: "task", title: t.title, url: `/tasks/${t.id}` }));
    (projects.data ?? []).forEach((p: any) => hits.push({ id: p.id, type: "project", title: p.title, url: `/projects/${p.id}` }));
    (goals.data ?? []).forEach((g: any) => hits.push({ id: g.id, type: "goal", title: g.title, url: `/execution?tab=goals&id=${g.id}` }));
    (records.data ?? []).forEach((r: any) => hits.push({ id: r.id, type: "record", title: r.title, url: `/databases/${r.id}` }));

    // Bias people first, then by simple score
    const scored = hits
      .map(h => ({ h, s: h.title.toLowerCase().startsWith(q.toLowerCase()) ? 0 : 1 }))
      .sort((a, b) => a.s - b.s)
      .slice(0, limit * 2)
      .map(x => x.h);

    return new Response(JSON.stringify({ hits: scored }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("universal-search error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
