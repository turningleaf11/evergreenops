// dept-focus — Albus synthesizes 1-3 priorities for a dept this week.
//
// Pulls the dept's active goals, projects, tasks, and issues. Asks OpenAI to
// pick the highest-leverage 1-3 things to push on this week, with citations
// back to specific entity ids. Caches the result by (department_id, week_start)
// so the team sees the same focus all week without burning OpenAI on page loads.
// Pass { force: true } to regenerate (admin-only).
//
// Request body: { department_id: string, force?: boolean }
// Response:     { priorities: [{ title, why, links: [{type,id,label}] }],
//                 week_start, generated_at, cached: boolean }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function mondayOf(d = new Date()): string {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return x.toISOString().split("T")[0];
}

function quarterOf(d = new Date()): string {
  const m = d.getMonth();
  return m < 3 ? "Q1" : m < 6 ? "Q2" : m < 9 ? "Q3" : "Q4";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization" }, 401);

    const { department_id, force } = await req.json();
    if (!department_id) return json({ error: "department_id required" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const OPENAI_MODEL = Deno.env.get("OPENAI_MODEL") ?? "gpt-4o-mini";
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Invalid token" }, 401);
    const admin = createClient(supabaseUrl, serviceKey);

    const weekStart = mondayOf();

    // Cache lookup unless force=true
    if (!force) {
      const { data: cached } = await admin
        .from("dept_focus_cache")
        .select("priorities, generated_at")
        .eq("department_id", department_id)
        .eq("week_start_date", weekStart)
        .maybeSingle();
      if (cached?.priorities) {
        return json({
          priorities: cached.priorities,
          week_start: weekStart,
          generated_at: cached.generated_at,
          cached: true,
        });
      }
    }

    // Pull dept context: goals, projects, tasks, issues, recent activity
    const today = new Date();
    const year = today.getFullYear();
    const q = quarterOf(today);
    const twoWeeksAgo = new Date(today.getTime() - 14 * 86400000).toISOString();

    const [deptRes, goalsRes, projectsRes, issuesRes] = await Promise.all([
      admin.from("departments").select("id, name, template_id").eq("id", department_id).maybeSingle(),
      admin.from("goals").select("id, title, status, progress, deadline").eq("department_id", department_id).eq("year", year).eq("quarter", q).limit(20),
      admin.from("projects").select("id, title, status, priority, due_date, updated_at, owner_id").eq("department_id", department_id).neq("status", "completed").limit(40),
      admin.from("issues").select("id, title, status, priority").eq("department_id", department_id).eq("status", "open").limit(10),
    ]);

    const dept = deptRes.data;
    if (!dept) return json({ error: "Department not found" }, 404);

    // Resolve template config (what inputs the focus weighs)
    const templateId = (dept as any).template_id || "generic";
    const { data: tpl } = await admin.from("dept_templates").select("name, config").eq("id", templateId).maybeSingle();
    const templateName = (tpl as any)?.name || "Generic";
    const focusInputs = ((tpl as any)?.config?.focus_inputs ?? ["goals", "tasks", "projects", "activity"]).join(", ");

    // Pull tasks for this dept's projects
    const projectIds = ((projectsRes.data as any[]) || []).map((p) => p.id);
    let tasksData: any[] = [];
    if (projectIds.length > 0) {
      const { data: tt } = await admin
        .from("tasks")
        .select("id, title, status, priority, project_id, due_date, updated_at")
        .in("project_id", projectIds)
        .neq("status", "done")
        .limit(50);
      tasksData = tt || [];
    }

    const goals = (goalsRes.data as any[]) || [];
    const projects = (projectsRes.data as any[]) || [];
    const issues = (issuesRes.data as any[]) || [];

    const goalLines = goals.length === 0
      ? "(no active goals)"
      : goals.map((g) => `- [id:${g.id}] "${g.title}" | ${g.progress}% | ${g.status}${g.deadline ? ` | due ${g.deadline}` : ""}`).join("\n");

    const projectLines = projects.length === 0
      ? "(no active projects)"
      : projects.slice(0, 30).map((p) => `- [id:${p.id}] "${p.title}" | ${p.status}/${p.priority}${p.due_date ? ` | due ${p.due_date}` : ""}${p.updated_at ? ` | updated ${p.updated_at.slice(0, 10)}` : ""}`).join("\n");

    const taskLines = tasksData.length === 0
      ? "(no open tasks)"
      : tasksData.slice(0, 30).map((t) => `- [id:${t.id}] "${t.title}" | ${t.status}/${t.priority}${t.due_date ? ` | due ${t.due_date}` : ""}`).join("\n");

    const issueLines = issues.length === 0
      ? "(no open issues)"
      : issues.map((i) => `- [id:${i.id}] "${i.title}" | P${i.priority}`).join("\n");

    const systemPrompt = `You are Albus, the chief-of-staff AI for the ${dept.name} team (template: ${templateName}).

Your job: synthesize 1-3 priorities the team should focus on THIS WEEK. Each priority must cite the specific goals, projects, tasks, or issues it draws from (using the [id:...] handles in the context).

Rules:
- 1 to 3 priorities only. Less is more. Be opinionated.
- Tie every priority to specific evidence in the context. Cite by id.
- Be concrete: "Push X across the line" beats "focus on revenue."
- If something is at risk (overdue, stalled, no progress), call it out.
- Prefer high-leverage items: things that unblock others or move goals.
- Output strict JSON only matching the schema below. No markdown fences.

Schema:
{
  "priorities": [
    {
      "title": "Short imperative — what to do this week (max 80 chars)",
      "why": "1-2 sentences: why this matters now, what risk or opportunity it addresses",
      "links": [
        { "type": "goal|project|task|issue", "id": "<id from context>", "label": "<short label>" }
      ]
    }
  ]
}

Inputs the template prioritizes: ${focusInputs}

=== ACTIVE GOALS (${q} ${year}) ===
${goalLines}

=== ACTIVE PROJECTS ===
${projectLines}

=== OPEN TASKS ===
${taskLines}

=== OPEN ISSUES ===
${issueLines}

Now output the JSON.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Output the JSON priorities now." },
        ],
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("OpenAI error", response.status, t.slice(0, 300));
      return json({ error: `OpenAI ${response.status}`, detail: t.slice(0, 200) }, 200);
    }

    const aiBody = await response.json();
    let content: string = aiBody?.choices?.[0]?.message?.content ?? "{}";
    content = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();

    let parsed: any;
    try { parsed = JSON.parse(content); }
    catch { return json({ error: "Albus returned malformed JSON", raw: content.slice(0, 300) }, 200); }

    const priorities = Array.isArray(parsed.priorities) ? parsed.priorities.slice(0, 3) : [];

    // Cache
    await admin.from("dept_focus_cache").upsert({
      department_id,
      week_start_date: weekStart,
      priorities,
      generated_by: user.id,
      generated_at: new Date().toISOString(),
    }, { onConflict: "department_id,week_start_date" });

    return json({
      priorities,
      week_start: weekStart,
      generated_at: new Date().toISOString(),
      cached: false,
    });
  } catch (e: any) {
    console.error("dept-focus error:", e);
    return json({ error: String(e?.message ?? e) }, 500);
  }
});
