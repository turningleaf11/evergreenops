// Daily AI briefing for the CEO Today tab.
// Assembles real workspace context and asks AI to produce
// 4-6 concise bullets + one "most important thing" focus sentence.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Anthropic from "npm:@anthropic-ai/sdk";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const AI_SERVICE_ENDPOINT = Deno.env.get("AI_SERVICE_ENDPOINT") ?? "";
const VERCEL_AI_API_KEY = Deno.env.get("VERCEL_AI_API_KEY") ?? "";

type BriefingContext = {
  today: string;
  current_objective_candidates: any[];
  my_tasks_due_soon: any[];
  delegation_items_open: any[];
  scorecard_this_week: any[];
  active_goals: any[];
  open_issues: any[];
  stale_projects_7d: any[];
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

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

async function safeQuery<T>(label: string, query: PromiseLike<{ data: T | null; error: any }>): Promise<T | null> {
  const { data, error } = await query;
  if (error) {
    console.warn(`[daily-briefing] ${label} query failed:`, error.message ?? error);
    return null;
  }
  return data;
}

function extractBearerToken(req: Request) {
  const auth = req.headers.get("Authorization") ?? "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

function cleanJsonText(text: string) {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function parseBriefing(raw: string): { bullets: string[]; focus: string } {
  try {
    const parsed = JSON.parse(cleanJsonText(raw));
    const bullets = Array.isArray(parsed.bullets)
      ? parsed.bullets.filter((b: unknown) => typeof b === "string" && b.trim()).slice(0, 8)
      : [];
    const focus = typeof parsed.focus === "string" ? parsed.focus.trim() : "";
    return { bullets, focus };
  } catch {
    return { bullets: raw.trim() ? [raw.trim()] : [], focus: "" };
  }
}

function fallbackBriefing(context: BriefingContext): { bullets: string[]; focus: string } {
  const bullets: string[] = [];
  const tasks = context.my_tasks_due_soon ?? [];
  const delegations = context.delegation_items_open ?? [];
  const offTrackMetrics = (context.scorecard_this_week ?? []).filter((m: any) => m.on_track === false);
  const goals = context.active_goals ?? [];
  const issues = context.open_issues ?? [];
  const staleProjects = context.stale_projects_7d ?? [];
  const objectives = context.current_objective_candidates ?? [];

  if (objectives.length) {
    bullets.push(`Current strategic context: ${objectives.slice(0, 2).map((o: any) => o.title).filter(Boolean).join(", ")}.`);
  }

  if (tasks.length) {
    bullets.push(`${tasks.length} task${tasks.length === 1 ? "" : "s"} assigned to you are due within the next 3 days; top item: ${tasks[0].title}.`);
  }

  if (delegations.length) {
    bullets.push(`${delegations.length} delegation item${delegations.length === 1 ? "" : "s"} remain open; oldest item: ${delegations[0].title}.`);
  }

  if (offTrackMetrics.length) {
    bullets.push(`${offTrackMetrics.length} scorecard metric${offTrackMetrics.length === 1 ? " is" : "s are"} below target this week: ${offTrackMetrics.map((m: any) => m.name).join(", ")}.`);
  }

  if (goals.length) {
    bullets.push(`${goals.length} active goal${goals.length === 1 ? " is" : "s are"} still in motion; most recent: ${goals[0].title}.`);
  }

  if (issues.length) {
    bullets.push(`${issues.length} open issue${issues.length === 1 ? " needs" : "s need"} attention; highest visible priority: ${issues[0].title}.`);
  }

  if (staleProjects.length) {
    bullets.push(`${staleProjects.length} project${staleProjects.length === 1 ? " has" : "s have"} had no update in 7+ days; oldest: ${staleProjects[0].title}.`);
  }

  if (!bullets.length) {
    bullets.push("No urgent tasks, issues, stale projects, or off-track metrics were found in the current workspace data.");
  }

  const focus = tasks[0]?.title
    ? `Focus today on moving "${tasks[0].title}" forward.`
    : issues[0]?.title
      ? `Focus today on resolving "${issues[0].title}".`
      : staleProjects[0]?.title
        ? `Focus today on unsticking "${staleProjects[0].title}".`
        : "Focus today on confirming the top priority and keeping momentum visible.";

  return { bullets: bullets.slice(0, 6), focus };
}

async function generateAiBriefing(context: BriefingContext): Promise<{ bullets: string[]; focus: string; source: string } | null> {
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

  if (ANTHROPIC_API_KEY) {
    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1200,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });
    const raw = response.content
      .filter((block: any) => block.type === "text")
      .map((block: any) => block.text)
      .join("\n");
    return { ...parseBriefing(raw), source: "anthropic" };
  }

  if (AI_SERVICE_ENDPOINT && VERCEL_AI_API_KEY) {
    const aiRes = await fetch(AI_SERVICE_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${VERCEL_AI_API_KEY}`,
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
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      throw new Error(`AI gateway failed (${aiRes.status}): ${errText.slice(0, 500)}`);
    }

    const aiData = await aiRes.json();
    const raw = aiData?.choices?.[0]?.message?.content ?? "{}";
    return { ...parseBriefing(raw), source: "ai_gateway" };
  }

  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return jsonResponse({ error: "Supabase environment is not configured" }, 500);
    }

    const token = extractBearerToken(req);
    if (!token) {
      return jsonResponse({ error: "Missing auth" }, 401);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    const user = userData?.user;
    if (userError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const now = new Date();
    const today = isoDate(now);
    const in3Days = isoDate(new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000));
    const weekStart = isoDate(startOfWeek(now));
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const profile = await safeQuery<any>(
      "profile",
      admin
        .from("profiles")
        .select("workspace_id, full_name")
        .eq("user_id", user.id)
        .maybeSingle(),
    );

    const firstName = (profile?.full_name || user.email || "there").split(" ")[0] || "there";

    const strategyItems = await safeQuery<any[]>(
      "strategy_items",
      admin
        .from("strategy_items" as any)
        .select("title, description, type, status")
        .order("created_at", { ascending: false })
        .limit(5),
    );

    const myTasks = await safeQuery<any[]>(
      "tasks",
      admin
        .from("tasks")
        .select("title, status, priority, due_date, projects(title)")
        .eq("assigned_to", user.id)
        .neq("status", "done")
        .lte("due_date", in3Days)
        .order("priority", { ascending: false })
        .order("due_date", { ascending: true })
        .limit(20),
    );

    const delegationItems = await safeQuery<any[]>(
      "reminders",
      admin
        .from("reminders" as any)
        .select("title, status, due_date, created_at")
        .neq("status", "done")
        .order("created_at", { ascending: true })
        .limit(20),
    );

    const metrics = await safeQuery<any[]>(
      "scorecard_metrics",
      admin
        .from("scorecard_metrics" as any)
        .select("id, name, weekly_target, unit")
        .eq("is_active", true)
        .limit(20),
    );

    const metricIds = (metrics ?? []).map((m: any) => m.id);
    let scorecardSummary: any[] = [];
    if (metricIds.length) {
      const entries = await safeQuery<any[]>(
        "scorecard_entries",
        admin
          .from("scorecard_entries" as any)
          .select("metric_id, actual_value, week_start_date")
          .in("metric_id", metricIds)
          .eq("week_start_date", weekStart),
      );
      const byMetric = new Map<string, any>();
      (entries ?? []).forEach((e: any) => byMetric.set(e.metric_id, e));
      scorecardSummary = (metrics ?? []).map((m: any) => {
        const e = byMetric.get(m.id);
        const onTrack = e && e.actual_value != null
          ? Number(e.actual_value) >= Number(m.weekly_target)
          : null;
        return {
          name: m.name,
          target: m.weekly_target,
          actual: e?.actual_value ?? null,
          unit: m.unit,
          on_track: onTrack,
        };
      });
    }

    const goals = await safeQuery<any[]>(
      "goals",
      admin
        .from("goals")
        .select("title, progress, status, quarter, year")
        .neq("status", "done")
        .order("year", { ascending: false })
        .order("quarter", { ascending: true })
        .limit(15),
    );

    const openIssues = await safeQuery<any[]>(
      "issues",
      admin
        .from("issues")
        .select("title, priority, status")
        .neq("status", "resolved")
        .order("priority", { ascending: true })
        .limit(10),
    );

    const staleProjects = await safeQuery<any[]>(
      "projects",
      admin
        .from("projects")
        .select("title, status, updated_at")
        .neq("status", "done")
        .lt("updated_at", sevenDaysAgo)
        .order("updated_at", { ascending: true })
        .limit(10),
    );

    const context: BriefingContext = {
      today,
      current_objective_candidates: strategyItems ?? [],
      my_tasks_due_soon: myTasks ?? [],
      delegation_items_open: delegationItems ?? [],
      scorecard_this_week: scorecardSummary,
      active_goals: goals ?? [],
      open_issues: openIssues ?? [],
      stale_projects_7d: staleProjects ?? [],
    };

    let generated = fallbackBriefing(context);
    let source = "fallback";
    let ai_error: string | null = null;

    try {
      const aiBriefing = await generateAiBriefing(context);
      if (aiBriefing?.bullets?.length || aiBriefing?.focus) {
        generated = { bullets: aiBriefing.bullets, focus: aiBriefing.focus };
        source = aiBriefing.source;
      }
    } catch (aiErr) {
      ai_error = aiErr instanceof Error ? aiErr.message : "Unknown AI error";
      console.error("daily-briefing AI failure", ai_error);
    }

    const generatedAt = new Date().toISOString();
    const { error: cacheError } = await admin
      .from("daily_briefings" as any)
      .upsert(
        {
          user_id: user.id,
          briefing_date: today,
          bullets: generated.bullets,
          focus: generated.focus,
          generated_at: generatedAt,
        },
        { onConflict: "user_id,briefing_date" },
      );

    if (cacheError) {
      console.warn("[daily-briefing] cache upsert failed:", cacheError.message);
    }

    return jsonResponse({
      bullets: generated.bullets,
      focus: generated.focus,
      generated_at: generatedAt,
      first_name: firstName,
      source,
      ai_error,
      cache_error: cacheError?.message ?? null,
    });
  } catch (e) {
    console.error("daily-briefing failure", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
