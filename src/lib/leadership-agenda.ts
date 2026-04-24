import { supabase } from "@/integrations/supabase/client";
import { startOfWeek, endOfWeek, subWeeks, differenceInDays } from "date-fns";

export type AgendaSection =
  | "segue"
  | "scorecard"
  | "rocks"
  | "todos"
  | "issues"
  | "strategy"
  | "conclude";

export interface AgendaSeed {
  section: AgendaSection;
  item_type: "auto" | "manual";
  title: string;
  description?: string | null;
  reference_type?: string | null;
  reference_id?: string | null;
  sort_order: number;
}

/** Build the full default agenda from live workspace data. */
export async function buildAgendaSeeds(meetingDate: Date = new Date()): Promise<AgendaSeed[]> {
  const seeds: AgendaSeed[] = [];
  let order = 0;
  const next = () => (order += 10);

  // ── 1. SEGUE ────────────────────────────────────────────────
  seeds.push({
    section: "segue",
    item_type: "auto",
    title: "Good news check-in — what's one win from this week?",
    description: null,
    sort_order: next(),
  });

  // ── 2. SCORECARD ────────────────────────────────────────────
  const weekStart = startOfWeek(meetingDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(meetingDate, { weekStartsOn: 1 });
  const weekStartStr = weekStart.toISOString().slice(0, 10);

  const { data: metrics } = await supabase
    .from("scorecard_metrics" as any)
    .select("id, name, weekly_target, unit")
    .eq("is_active", true);

  const { data: entries } = await supabase
    .from("scorecard_entries" as any)
    .select("metric_id, actual_value, week_start_date")
    .eq("week_start_date", weekStartStr);

  const actualByMetric = new Map<string, number>();
  for (const e of (entries || []) as any[]) actualByMetric.set(e.metric_id, Number(e.actual_value) || 0);

  let onTrack = 0;
  let totalScored = 0;
  for (const m of (metrics || []) as any[]) {
    const target = Number(m.weekly_target) || 0;
    const actual = actualByMetric.get(m.id) ?? 0;
    if (target <= 0) continue;
    totalScored += 1;
    if (actual < target) {
      seeds.push({
        section: "scorecard",
        item_type: "auto",
        title: m.name,
        description: `Off track — Target: ${target}${m.unit ? ` ${m.unit}` : ""}, Actual: ${actual}${m.unit ? ` ${m.unit}` : ""}`,
        reference_type: "scorecard_metric",
        reference_id: m.id,
        sort_order: next(),
      });
    } else {
      onTrack += 1;
    }
  }
  if (totalScored > 0) {
    seeds.push({
      section: "scorecard",
      item_type: "auto",
      title: `Scorecard — ${onTrack} of ${totalScored} metrics on track this week`,
      description: null,
      sort_order: next(),
    });
  }

  // ── 3. ROCKS (current quarter goals) ────────────────────────
  const now = meetingDate;
  const month = now.getMonth();
  const quarter = `Q${Math.floor(month / 3) + 1}` as "Q1" | "Q2" | "Q3" | "Q4";
  const year = now.getFullYear();

  // Halfway-point check: are we past day 45 of the quarter?
  const quarterStartMonth = Math.floor(month / 3) * 3;
  const quarterStart = new Date(year, quarterStartMonth, 1);
  const pastHalfway = differenceInDays(now, quarterStart) > 45;

  const { data: goals } = await supabase
    .from("goals")
    .select("id, title, status, progress")
    .eq("year", year)
    .eq("quarter", quarter);

  const onTrackGoals: string[] = [];
  for (const g of (goals || []) as any[]) {
    const isOffTrack = g.status === "off_track" || g.status === "off track";
    const atRisk = pastHalfway && (g.progress ?? 0) < 50;
    if (isOffTrack) {
      seeds.push({
        section: "rocks",
        item_type: "auto",
        title: g.title,
        description: `Off track — ${g.progress ?? 0}% complete`,
        reference_type: "goal",
        reference_id: g.id,
        sort_order: next(),
      });
    } else if (atRisk) {
      seeds.push({
        section: "rocks",
        item_type: "auto",
        title: g.title,
        description: `At risk — ${g.progress ?? 0}% complete past quarter halfway`,
        reference_type: "goal",
        reference_id: g.id,
        sort_order: next(),
      });
    } else {
      onTrackGoals.push(g.title);
    }
  }
  if (onTrackGoals.length > 0) {
    seeds.push({
      section: "rocks",
      item_type: "auto",
      title: `Rocks on track: ${onTrackGoals.join(", ")}`,
      description: null,
      sort_order: next(),
    });
  }

  // ── 4. TO-DOS — incomplete tasks from last week's leadership meeting ─
  const lastWeekStart = subWeeks(weekStart, 1);
  const { data: lastMeetings } = await supabase
    .from("leadership_meetings" as any)
    .select("id")
    .eq("meeting_week", lastWeekStart.toISOString().slice(0, 10));

  if (lastMeetings && lastMeetings.length > 0) {
    const lastIds = (lastMeetings as any[]).map((m) => m.id);
    const { data: prevActions } = await supabase
      .from("leadership_meeting_action_items" as any)
      .select("title, assigned_to, converted_to_task_id")
      .in("meeting_id", lastIds)
      .not("converted_to_task_id", "is", null);

    const taskIds = ((prevActions || []) as any[]).map((a) => a.converted_to_task_id).filter(Boolean);
    if (taskIds.length > 0) {
      const { data: tasks } = await supabase
        .from("tasks")
        .select("id, title, status, assigned_to")
        .in("id", taskIds);

      // assignee name lookup
      const assigneeIds = Array.from(new Set(((tasks || []) as any[]).map((t) => t.assigned_to).filter(Boolean)));
      const { data: profs } = assigneeIds.length
        ? await supabase.from("profiles").select("user_id, full_name").in("user_id", assigneeIds)
        : { data: [] as any[] };
      const nameByUser = new Map<string, string>();
      for (const p of (profs || []) as any[]) nameByUser.set(p.user_id, p.full_name || "Unassigned");

      for (const t of (tasks || []) as any[]) {
        if (t.status === "done" || t.status === "completed") continue;
        seeds.push({
          section: "todos",
          item_type: "auto",
          title: t.title,
          description: `Assigned to ${nameByUser.get(t.assigned_to) || "Unassigned"} — still open`,
          reference_type: "task",
          reference_id: t.id,
          sort_order: next(),
        });
      }
    }
  }

  // ── 5. ISSUES — open, sorted by priority (high first; lower number = higher) ─
  const { data: issues } = await supabase
    .from("issues")
    .select("id, title, priority")
    .eq("status", "open")
    .order("priority", { ascending: true });

  for (const i of (issues || []) as any[]) {
    seeds.push({
      section: "issues",
      item_type: "auto",
      title: i.title,
      description: null,
      reference_type: "issue",
      reference_id: i.id,
      sort_order: next(),
    });
  }

  // ── 6. STRATEGY — new items, or stale (>14d no review activity) ─
  const { data: strategyItems } = await supabase
    .from("strategy_items" as any)
    .select("id, title, status, updated_at");

  const strategyIds = ((strategyItems || []) as any[]).map((s) => s.id);
  let lastResponseByItem = new Map<string, string>();
  if (strategyIds.length > 0) {
    const { data: responses } = await supabase
      .from("strategy_responses" as any)
      .select("strategy_item_id, created_at")
      .in("strategy_item_id", strategyIds)
      .order("created_at", { ascending: false });
    for (const r of (responses || []) as any[]) {
      if (!lastResponseByItem.has(r.strategy_item_id)) {
        lastResponseByItem.set(r.strategy_item_id, r.created_at);
      }
    }
  }

  for (const s of (strategyItems || []) as any[]) {
    const isNew = s.status === "new";
    const lastActivity = lastResponseByItem.get(s.id) || s.updated_at;
    const stale = lastActivity && differenceInDays(now, new Date(lastActivity)) >= 14;
    if (isNew || stale) {
      seeds.push({
        section: "strategy",
        item_type: "auto",
        title: `Strategy: ${s.title} — needs team alignment`,
        description: null,
        reference_type: "strategy_item",
        reference_id: s.id,
        sort_order: next(),
      });
    }
  }

  // ── 7. CONCLUDE ─────────────────────────────────────────────
  seeds.push({
    section: "conclude",
    item_type: "auto",
    title: "Action items review + meeting rating",
    description: null,
    sort_order: next(),
  });

  return seeds;
}

/**
 * Create a leadership meeting (if none exists for the given week's Monday)
 * and seed its agenda. Returns the meeting id.
 */
export async function createLeadershipMeetingWithAgenda(opts: {
  meetingDate: Date;
  createdBy: string | null;
  workspaceId: string | null;
}): Promise<{ id: string; created: boolean }> {
  const monday = startOfWeek(opts.meetingDate, { weekStartsOn: 1 });
  const mondayStr = monday.toISOString().slice(0, 10);

  // De-dup
  const { data: existing } = await supabase
    .from("leadership_meetings" as any)
    .select("id")
    .eq("meeting_week", mondayStr)
    .maybeSingle();
  if (existing) return { id: (existing as any).id, created: false };

  const { data: meeting, error } = await supabase
    .from("leadership_meetings" as any)
    .insert({
      meeting_date: opts.meetingDate.toISOString().slice(0, 10),
      meeting_week: mondayStr,
      status: "draft",
      created_by: opts.createdBy,
      workspace_id: opts.workspaceId,
    })
    .select("id")
    .single();
  if (error || !meeting) throw error || new Error("Failed to create meeting");

  const seeds = await buildAgendaSeeds(opts.meetingDate);
  if (seeds.length > 0) {
    await supabase.from("meeting_agenda_items" as any).insert(
      seeds.map((s) => ({
        meeting_id: (meeting as any).id,
        section: s.section,
        item_type: s.item_type,
        title: s.title,
        description: s.description ?? null,
        reference_type: s.reference_type ?? null,
        reference_id: s.reference_id ?? null,
        sort_order: s.sort_order,
        added_by: opts.createdBy,
      })),
    );
  }
  return { id: (meeting as any).id, created: true };
}

export const SECTION_ORDER: AgendaSection[] = [
  "segue",
  "scorecard",
  "rocks",
  "todos",
  "issues",
  "strategy",
  "conclude",
];

export const SECTION_META: Record<AgendaSection, { label: string; subtitle: string }> = {
  segue: { label: "Segue", subtitle: "Wins & check-ins" },
  scorecard: { label: "Scorecard", subtitle: "Weekly metrics review" },
  rocks: { label: "Rocks", subtitle: "Quarterly goals" },
  todos: { label: "To-Dos", subtitle: "Last week's commitments" },
  issues: { label: "Issues", subtitle: "Open friction to resolve" },
  strategy: { label: "Strategy", subtitle: "Direction & alignment" },
  conclude: { label: "Conclude", subtitle: "Action items + rating" },
};
