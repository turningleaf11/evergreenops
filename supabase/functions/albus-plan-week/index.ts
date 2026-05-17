// Albus Plan the Week — pulls full workspace context (vision, goals, projects,
// tasks, scorecard, dept members, recent activity) and asks the AI gateway for a
// structured week-plan proposal that the user can accept item-by-item.

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

function quarterOf(d: Date) {
  const m = d.getMonth();
  return m < 3 ? "Q1" : m < 6 ? "Q2" : m < 9 ? "Q3" : "Q4";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Invalid token" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);

    const today = new Date();
    const q = quarterOf(today);
    const year = today.getFullYear();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay() + 1);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    // Pull workspace context in parallel
    const [
      profileRes,
      goalsRes,
      projectsRes,
      tasksRes,
      strategyRes,
      visionRes,
      departmentsRes,
      profilesRes,
      scorecardRes,
    ] = await Promise.all([
      admin.from("profiles").select("workspace_id, full_name").eq("user_id", user.id).maybeSingle(),
      admin.from("goals").select("id, title, status, progress, quarter, year, deadline, department_id").eq("year", year).eq("quarter", q),
      admin.from("projects").select("id, title, status, priority, due_date, department_id, owner_id, description").neq("status", "completed").limit(50),
      admin.from("tasks").select("id, title, status, priority, due_date, assigned_to, project_id, description").neq("status", "done").limit(100),
      admin.from("strategy_items").select("id, title, description, status, type, assigned_departments").neq("status", "resolved").limit(20),
      admin.from("vision_sections").select("section_key, content").limit(20),
      admin.from("departments").select("id, name").limit(20),
      admin.from("profiles").select("user_id, full_name, department_id, is_leader").limit(50),
      admin.from("scorecard_entries").select("metric_id, week_start_date, actual").gte("week_start_date", new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)).limit(50),
    ]);

    const ctx = {
      ceoName: (profileRes.data as any)?.full_name || "the CEO",
      period: `${q} ${year}`,
      week: `${weekStart.toISOString().slice(0, 10)} – ${weekEnd.toISOString().slice(0, 10)}`,
      vision: (visionRes.data ?? []).map((v: any) => `${v.section_key}: ${v.content?.slice(0, 200) ?? ""}`).join("\n"),
      goals: (goalsRes.data ?? []).map((g: any) => `[${g.status}] ${g.title} — ${g.progress}%${g.deadline ? ` (deadline ${g.deadline})` : ""}`).join("\n"),
      strategyItems: (strategyRes.data ?? []).map((s: any) => `[${s.status}] ${s.title}${s.description ? ` — ${s.description.slice(0, 150)}` : ""}`).join("\n"),
      activeProjects: (projectsRes.data ?? []).map((p: any) => `id=${p.id} | [${p.status}/${p.priority}] ${p.title}${p.due_date ? ` (due ${p.due_date})` : ""}${p.description ? ` — ${p.description.slice(0, 120)}` : ""}`).join("\n"),
      openTasks: (tasksRes.data ?? []).map((t: any) => `id=${t.id} | [${t.status}/${t.priority}] ${t.title}${t.due_date ? ` (due ${t.due_date})` : ""}`).join("\n"),
      departments: (departmentsRes.data ?? []).map((d: any) => `${d.id}:${d.name}`).join("\n"),
      teamMembers: (profilesRes.data ?? []).map((p: any) => `${p.user_id}:${p.full_name}${p.is_leader ? " (leader)" : ""}${p.department_id ? ` dept=${p.department_id}` : ""}`).join("\n"),
      scorecardLast2Weeks: `${(scorecardRes.data ?? []).length} entries`,
    };

    const systemPrompt = `You are Albus, the chief-of-staff AI for ${ctx.ceoName}. You see the full operating context of the business: the vision, current-quarter goals, active strategy items, every open project and task, every person on the team, and recent scorecard entries.

Your job today: propose a focused week plan for ${ctx.week}. You are not generating a wall of suggestions. You are the seasoned operator at the start of the week saying: "Here's what I'd focus on, here's why, here's who should own each piece."

Rules:
- Tie every suggestion to a goal or strategy item. No floating busywork.
- Be specific. If you suggest a task, say what "done" looks like.
- Use existing project_id/department_id/user_id values where relevant — they're in the context.
- If something is already at risk (slipping deadline, no recent progress), call it out.
- Cap suggestions: at most 3 priorities, 3 new tasks, 2 new projects. Less is more.
- If you have low confidence on assignee, leave assignee_hint null.
- Output strict JSON only matching the schema below. No prose outside JSON.

Schema:
{
  "headline": "1-2 sentence read on the week — what matters most, what's at risk.",
  "priorities": [
    { "title": "...", "why": "Ties to {goal/strategy_item}: ..." }
  ],
  "new_projects": [
    { "title": "...", "description": "...", "department_id": "uuid or null", "rationale": "Why this week, ties to which goal" }
  ],
  "new_tasks": [
    { "title": "...", "description": "Definition of done", "assignee_user_id": "uuid or null", "project_id": "uuid or null", "priority": "low|medium|high", "rationale": "..." }
  ],
  "risks": [
    { "issue": "...", "mitigation": "..." }
  ]
}

CONTEXT
=======

VISION:
${ctx.vision || "(not set)"}

CURRENT GOALS (${ctx.period}):
${ctx.goals || "(none)"}

STRATEGY ITEMS IN FLIGHT:
${ctx.strategyItems || "(none)"}

ACTIVE PROJECTS:
${ctx.activeProjects || "(none)"}

OPEN TASKS:
${ctx.openTasks || "(none)"}

DEPARTMENTS:
${ctx.departments}

TEAM:
${ctx.teamMembers}

Now produce the JSON week plan.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Plan the week. Output strict JSON only." },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("AI gateway error", response.status, t);
      return json({ error: `AI gateway returned ${response.status}`, detail: t.slice(0, 300) }, 500);
    }

    const aiBody = await response.json();
    const content = aiBody?.choices?.[0]?.message?.content ?? "{}";
    let plan: any;
    try { plan = JSON.parse(content); }
    catch { return json({ error: "AI returned malformed JSON", raw: content.slice(0, 500) }, 500); }

    return json({ plan, week: ctx.week });
  } catch (e: any) {
    console.error("albus-plan-week error:", e);
    return json({ error: String(e?.message ?? e) }, 500);
  }
});
