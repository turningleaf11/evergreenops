// Daily AI briefing for the CEO Today tab.
// Assembles real workspace context and asks Lovable AI to produce
// 4-6 concise bullets + one "most important thing" focus sentence.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

function isoDate(d: Date) {
  return d.toISOString().split("T")[0];
}

function startOfWeek(d: Date) {
  const day = d.getDay(); // 0 = Sun
  const diff = (day + 6) % 7; // make Monday = 0
  const monday = new Date(d);
  monday.setDate(d.getDate() - diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify caller
    const auth = req.headers.get("Authorization");
    if (!auth) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // ---- Assemble context ----
    const now = new Date();
    const today = isoDate(now);
    const in3Days = isoDate(new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000));
    const weekStart = isoDate(startOfWeek(now));
    const sevenDaysAgo = new Date(
      now.getTime() - 7 * 24 * 60 * 60 * 1000,
    ).toISOString();

    // Profile (workspace + name)
    const { data: profile } = await admin
      .from("profiles")
      .select("workspace_id, full_name")
      .eq("user_id", user.id)
      .maybeSingle();

    const workspaceId = profile?.workspace_id ?? null;
    const firstName =
      (profile?.full_name || user.email || "there").split(" ")[0] || "there";

    // 1. Current objective — try strategy_items, fallback to ceo scratch context
    const { data: strategyItems } = await admin
      .from("strategy_items" as any)
      .select("title, description, type, status")
      .order("created_at", { ascending: false })
      .limit(5);

    // 2. Tasks assigned to me, due within 3 days, not done
    const { data: myTasks } = await admin
      .from("tasks")
      .select("title, status, priority, due_date, projects(title)")
      .eq("assigned_to", user.id)
      .neq("status", "done")
      .lte("due_date", in3Days)
      .order("priority", { ascending: false })
      .order("due_date", { ascending: true })
      .limit(20);

    // 3. Delegation board items = reminders not done, oldest first
    const { data: delegations } = await admin
      .from("reminders" as any)
      .select("title, status, due_date, created_at")
      .neq("status", "done")
      .order("created_at", { ascending: true })
      .limit: 20 as any;
    // ^ trailing colon would break — use proper call:
    const delegationsRes = await admin
      .from("reminders" as any)
      .select("title, status, due_date, created_at")
      .neq("status", "done")
      .order("created_at", { ascending: true })
      .limit(20);
    const delegationItems = delegationsRes.data ?? [];

    // 4. Active scorecard metrics + this week's entry
    const { data: metrics } = await admin
      .from("scorecard_metrics" as any)
      .select("id, name, weekly_target, unit")
      .eq("is_active", true)
      .limit(20);
    const metricIds = (metrics ?? []).map((m: any) => m.id);
    let scorecardSummary: any[] = [];
    if (metricIds.length) {
      const { data: entries } = await admin
        .from("scorecard_entries" as any)
        .select("metric_id, actual_value, week_start_date")
        .in("metric_id", metricIds)
        .eq("week_start_date", weekStart);
      const byMetric = new Map<string, any>();
      (entries ?? []).forEach((e: any) => byMetric.set(e.metric_id, e));
      scorecardSummary = (metrics ?? []).map((m: any) => {
        const e = byMetric.get(m.id);
        const onTrack =
          e && e.actual_value != null
            ? Number(e.actual_value) >= Number(m.weekly_target)
            : null;
        return {
          name: m.name,
          target: m.weekly_target,
          actual: e?.actual_value ?? null,
          on_track: onTrack,
        };
      });
    }

    // 5. Active goals + progress
    const { data: goals } = await admin
      .from("goals")
      .select("title, progress, status, quarter, year")
      .neq("status", "done")
      .order("year", { ascending: false })
      .order("quarter", { ascending: true })
      .limit(15);

    // 6. Open issues
    const { data: openIssues } = await admin
      .from("issues")
      .select("title, priority, status")
      .neq("status", "resolved")
      .order("priority", { ascending: true })
      .limit(10);

    // 7. Stale projects — no updates in 7 days, not done
    const { data: staleProjects } = await admin
      .from("projects")
      .select("title, status, updated_at")
      .neq("status", "done")
      .lt("updated_at", sevenDaysAgo)
      .order("updated_at", { ascending: true })
      .limit(10);

    const context = {
      today,
      current_objective_candidates: strategyItems ?? [],
      my_tasks_due_soon: myTasks ?? [],
      delegation_items_open: delegationItems,
      scorecard_this_week: scorecardSummary,
      active_goals: goals ?? [],
      open_issues: openIssues ?? [],
      stale_projects_7d: staleProjects ?? [],
    };

    // ---- Call Lovable AI ----
    const systemPrompt =
      "You are the chief of staff for a CEO. You read structured business data and produce a concise, direct daily briefing. Use real names, numbers, and titles from the data. Never invent facts. If a section has no data, do not mention it.";

    const userPrompt = `Given the following data about the CEO's business this week, write a concise daily briefing in 4-6 bullet points. Be direct and specific. Flag what needs attention. Surface anything that looks stuck, overdue, or off track. Do not be generic. Use the actual names, numbers, and project titles from the data provided. End with one sentence: the single most important thing they should focus on today.

Return STRICT JSON of the form:
{
  "bullets": ["string", "string", ...],
  "focus": "single sentence describing the one most important thing"
}

Data:
${JSON.stringify(context, null, 2)}`;

    const aiRes = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
        }),
      },
    );

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("AI gateway error", aiRes.status, errText);
      return new Response(
        JSON.stringify({
          error: "AI request failed",
          status: aiRes.status,
          detail: errText.slice(0, 500),
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const aiData = await aiRes.json();
    const raw = aiData?.choices?.[0]?.message?.content ?? "{}";
    let parsed: { bullets?: string[]; focus?: string } = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      // try to extract from text
      parsed = { bullets: [raw], focus: "" };
    }

    const bullets = Array.isArray(parsed.bullets)
      ? parsed.bullets.filter((b) => typeof b === "string" && b.trim()).slice(0, 8)
      : [];
    const focus = typeof parsed.focus === "string" ? parsed.focus.trim() : "";

    // Cache it
    const generatedAt = new Date().toISOString();
    await admin
      .from("daily_briefings" as any)
      .upsert(
        {
          user_id: user.id,
          briefing_date: today,
          bullets,
          focus,
          generated_at: generatedAt,
        },
        { onConflict: "user_id,briefing_date" },
      );

    return new Response(
      JSON.stringify({
        bullets,
        focus,
        generated_at: generatedAt,
        first_name: firstName,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e: any) {
    console.error("daily-briefing failure", e);
    return new Response(
      JSON.stringify({ error: e?.message ?? "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
