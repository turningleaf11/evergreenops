import { supabase } from "@/integrations/supabase/client";

/**
 * Assemble the full business-context block for CEO strategy AI conversations.
 * Pulls live data from vision, goals, scorecard, strategy, issues, team,
 * business memory, and delegations.
 */
export interface AssembledStrategyContext {
  workspaceName: string;
  userName: string;
  vision: {
    coreValues: string[];
    purpose: string;
    niche: string;
    tenYearTarget: string;
    threeYearPicture: string;
    oneYearPlan: string;
  };
  currentQuarter: string;
  currentYear: number;
  rocks: Array<{ title: string; progress: number; status: string }>;
  scorecard: Array<{ name: string; target: number; actual: number | null; unit: string; onTrack: boolean | null }>;
  strategyItems: Array<{ title: string; status: string; description: string }>;
  openIssues: Array<{ title: string; category: string; priority: number }>;
  team: Array<{ name: string; title: string | null; departmentId: string | null }>;
  businessMemory: Array<{ memory_type: string; title: string; content: string }>;
  delegations: { perPerson: Record<string, number>; overdueCount: number };
  businessPlans: Array<{
    title: string; status: string; priority: string; oneLiner: string;
    deliverablesDone: number; deliverablesTotal: number; openRoles: number;
  }>;
}

function getQuarter(d = new Date()): string {
  const m = d.getMonth();
  return `Q${Math.floor(m / 3) + 1}`;
}

function startOfWeekMonday(d = new Date()): string {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return x.toISOString().split("T")[0];
}

function asArray(v: any): string[] {
  if (Array.isArray(v)) return v.filter(Boolean).map(String);
  if (typeof v === "string" && v.trim()) return [v];
  return [];
}

function asString(v: any): string {
  if (typeof v === "string") return v;
  if (v == null) return "";
  return String(v);
}

export async function assembleStrategyContext(opts: {
  userName: string;
  workspaceId: string | null;
}): Promise<AssembledStrategyContext> {
  const now = new Date();
  const year = now.getFullYear();
  const quarter = getQuarter(now);
  const weekStart = startOfWeekMonday(now);
  const today = now.toISOString().split("T")[0];

  // Workspace name
  let workspaceName = "the company";
  if (opts.workspaceId) {
    const { data: ws } = await supabase
      .from("workspaces")
      .select("name")
      .eq("id", opts.workspaceId)
      .maybeSingle();
    if (ws?.name) workspaceName = ws.name;
  }

  // Run independent queries in parallel
  const [
    visionRes,
    goalsRes,
    metricsRes,
    strategyRes,
    issuesRes,
    teamRes,
    memoryRes,
    remindersRes,
    plansRes,
    planDeliverablesRes,
    planRolesRes,
  ] = await Promise.all([
    supabase.from("vision").select("section,content").order("sort_order"),
    supabase
      .from("goals")
      .select("title,progress,status,quarter,year")
      .eq("quarter", quarter)
      .eq("year", year),
    supabase
      .from("scorecard_metrics")
      .select("id,name,weekly_target,unit")
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("strategy_items")
      .select("title,status,description")
      .neq("status", "resolved")
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("issues")
      .select("title,category,priority")
      .eq("status", "open")
      .order("priority", { ascending: true })
      .limit(20),
    supabase
      .from("profiles")
      .select("full_name,title,department_id")
      .eq("workspace_id", opts.workspaceId ?? "00000000-0000-0000-0000-000000000000")
      .limit(50),
    supabase
      .from("ai_business_memory")
      .select("memory_type,title,content,is_active,expires_at")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("reminders")
      .select("id,assigned_to,due_at,completed")
      .eq("completed", false)
      .limit(200),
    supabase
      .from("business_plans")
      .select("id,title,status,priority,one_liner")
      .order("priority"),
    supabase.from("business_plan_deliverables").select("business_plan_id,status"),
    supabase.from("business_plan_roles").select("business_plan_id,assigned_user_id"),
  ]);

  // Vision parsing
  const visionMap: Record<string, any> = {};
  for (const row of visionRes.data || []) {
    visionMap[row.section] = row.content || {};
  }
  const vision = {
    coreValues: asArray(
      visionMap.core_values?.values ??
        visionMap.core_values?.items ??
        visionMap.values?.values ??
        visionMap.values
    ),
    purpose: asString(
      visionMap.core_focus?.purpose ?? visionMap.purpose?.text ?? visionMap.purpose
    ),
    niche: asString(
      visionMap.core_focus?.niche ?? visionMap.niche?.text ?? visionMap.niche
    ),
    tenYearTarget: asString(
      visionMap.ten_year_target?.text ??
        visionMap.bhag?.text ??
        visionMap.ten_year_target
    ),
    threeYearPicture: asString(
      visionMap.three_year_picture?.text ?? visionMap.three_year_picture
    ),
    oneYearPlan: asString(
      visionMap.one_year_plan?.text ?? visionMap.one_year_plan
    ),
  };

  // Scorecard: get this week's entries
  const metrics = metricsRes.data || [];
  const metricIds = metrics.map((m: any) => m.id);
  let entries: any[] = [];
  if (metricIds.length > 0) {
    const { data: entryData } = await supabase
      .from("scorecard_entries")
      .select("metric_id,actual_value,week_start_date")
      .in("metric_id", metricIds)
      .eq("week_start_date", weekStart);
    entries = entryData || [];
  }
  const scorecard = metrics.map((m: any) => {
    const entry = entries.find((e) => e.metric_id === m.id);
    const actual = entry?.actual_value ?? null;
    const onTrack = actual == null ? null : Number(actual) >= Number(m.weekly_target);
    return {
      name: m.name,
      target: Number(m.weekly_target) || 0,
      actual: actual == null ? null : Number(actual),
      unit: m.unit,
      onTrack,
    };
  });

  // Business plans — rollups computed client-side from the same tables the
  // Business Plans pages use, so the AI sees the same numbers a person would.
  const planDeliverableCounts: Record<string, { done: number; total: number }> = {};
  for (const d of planDeliverablesRes.data || []) {
    const b = planDeliverableCounts[(d as any).business_plan_id] || { done: 0, total: 0 };
    b.total += 1;
    if ((d as any).status === "done") b.done += 1;
    planDeliverableCounts[(d as any).business_plan_id] = b;
  }
  const planOpenRoles: Record<string, number> = {};
  for (const r of planRolesRes.data || []) {
    if (!(r as any).assigned_user_id) {
      planOpenRoles[(r as any).business_plan_id] = (planOpenRoles[(r as any).business_plan_id] || 0) + 1;
    }
  }

  // Delegations
  const reminders = remindersRes.data || [];
  const perPerson: Record<string, number> = {};
  let overdueCount = 0;
  for (const r of reminders) {
    if (!r.assigned_to) continue;
    perPerson[r.assigned_to] = (perPerson[r.assigned_to] || 0) + 1;
    if (r.due_at && new Date(r.due_at) < new Date(today)) overdueCount++;
  }

  return {
    workspaceName,
    userName: opts.userName || "the CEO",
    vision,
    currentQuarter: quarter,
    currentYear: year,
    rocks: (goalsRes.data || []).map((g: any) => ({
      title: g.title,
      progress: Number(g.progress) || 0,
      status: g.status || "on_track",
    })),
    scorecard,
    strategyItems: (strategyRes.data || []).map((s: any) => ({
      title: s.title,
      status: s.status,
      description: s.description || "",
    })),
    openIssues: (issuesRes.data || []).map((i: any) => ({
      title: i.title,
      category: i.category,
      priority: Number(i.priority) || 3,
    })),
    team: (teamRes.data || []).map((p: any) => ({
      name: p.full_name || "(unnamed)",
      title: p.title,
      departmentId: p.department_id,
    })),
    businessMemory: (memoryRes.data || [])
      .filter((m: any) => !m.expires_at || new Date(m.expires_at) > new Date())
      .map((m: any) => ({
        memory_type: m.memory_type,
        title: m.title,
        content: m.content,
      })),
    delegations: { perPerson, overdueCount },
    businessPlans: (plansRes.data || []).map((p: any) => ({
      title: p.title,
      status: p.status,
      priority: p.priority || "medium",
      oneLiner: p.one_liner || "",
      deliverablesDone: planDeliverableCounts[p.id]?.done || 0,
      deliverablesTotal: planDeliverableCounts[p.id]?.total || 0,
      openRoles: planOpenRoles[p.id] || 0,
    })),
  };
}
