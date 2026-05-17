import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Flag, Target, CheckSquare, FolderKanban, Loader2 } from "lucide-react";
import { startOfWeek, endOfWeek, format } from "date-fns";
import { cn } from "@/lib/utils";

const sb = supabase as any;

type ProjectRow = { id: string; title: string; status: string; priority: string; due_date: string };
type TaskRow = { id: string; title: string; status: string; priority: string; due_date: string };
type GoalRow = { id: string; title: string; status: string; progress: number; quarter: string; year: number };

function quarterOf(date: Date): { q: string; year: number } {
  const m = date.getMonth();
  const q = m < 3 ? "Q1" : m < 6 ? "Q2" : m < 9 ? "Q3" : "Q4";
  return { q, year: date.getFullYear() };
}

/**
 * This Week's Milestones — replaces the disconnected 3-priority text widget.
 * Pulls real items landing this week: projects + tasks with due_date in [Mon..Sun],
 * plus quarterly goals so weekly work always traces back to the big rocks.
 */
export function ThisWeekMilestones() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [loading, setLoading] = useState(true);

  const today = useMemo(() => new Date(), []);
  const monday = useMemo(() => startOfWeek(today, { weekStartsOn: 1 }), [today]);
  const sunday = useMemo(() => endOfWeek(today, { weekStartsOn: 1 }), [today]);
  const mondayIso = format(monday, "yyyy-MM-dd");
  const sundayIso = format(sunday, "yyyy-MM-dd");
  const { q, year } = useMemo(() => quarterOf(today), [today]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [{ data: projRows }, { data: taskRows }, { data: goalRows }] = await Promise.all([
        sb.from("projects")
          .select("id, title, status, priority, due_date")
          .gte("due_date", mondayIso)
          .lte("due_date", sundayIso)
          .order("due_date", { ascending: true }),
        sb.from("tasks")
          .select("id, title, status, priority, due_date")
          .gte("due_date", mondayIso)
          .lte("due_date", sundayIso)
          .neq("status", "done")
          .order("due_date", { ascending: true }),
        sb.from("goals")
          .select("id, title, status, progress, quarter, year")
          .eq("quarter", q)
          .eq("year", year)
          .order("progress", { ascending: false }),
      ]);
      if (cancelled) return;
      setProjects((projRows ?? []) as ProjectRow[]);
      setTasks((taskRows ?? []) as TaskRow[]);
      setGoals((goalRows ?? []) as GoalRow[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user, mondayIso, sundayIso, q, year]);

  const total = projects.length + tasks.length + goals.length;

  return (
    <div className="rounded-2xl border border-border/50 bg-card/80 p-5 elevation-1 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flag className="h-3.5 w-3.5 text-primary" />
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">This Week's Milestones</h2>
        </div>
        <span className="text-[11px] text-muted-foreground/60">{format(monday, "MMM d")} – {format(sunday, "MMM d")}</span>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
          <Loader2 className="h-3 w-3 animate-spin" /> Loading…
        </div>
      ) : total === 0 ? (
        <div className="text-center py-6 space-y-2">
          <p className="text-sm text-muted-foreground/70">Nothing landing this week.</p>
          <div className="flex items-center justify-center gap-3 text-[11px]">
            <Link to="/execution" className="text-primary hover:underline">Plan in Execution Hub →</Link>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Quarterly goals — the why */}
          {goals.length > 0 && (
            <Section
              icon={<Target className="h-3.5 w-3.5 text-emerald-600" />}
              label={`${q} ${year} Goals`}
              count={goals.length}
            >
              {goals.slice(0, 4).map((g) => (
                <Link key={g.id} to="/scorecard" className="block group">
                  <div className="flex items-center gap-2.5 py-1.5 px-2 rounded-md hover:bg-muted/40 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate group-hover:text-primary">{g.title}</p>
                    </div>
                    <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">{g.progress}%</span>
                  </div>
                </Link>
              ))}
              {goals.length > 4 && <ViewMore to="/scorecard" label={`+${goals.length - 4} more goals`} />}
            </Section>
          )}

          {/* Projects with due_date this week — the bets */}
          {projects.length > 0 && (
            <Section
              icon={<FolderKanban className="h-3.5 w-3.5 text-sky-600" />}
              label="Projects due"
              count={projects.length}
            >
              {projects.slice(0, 5).map((p) => (
                <Link key={p.id} to={`/projects/${p.id}`} className="block group">
                  <div className="flex items-center gap-2.5 py-1.5 px-2 rounded-md hover:bg-muted/40 transition-colors">
                    <PriorityDot priority={p.priority} />
                    <span className="text-sm text-foreground truncate flex-1 group-hover:text-primary">{p.title}</span>
                    <span className="text-[11px] text-muted-foreground/70 shrink-0">{format(new Date(p.due_date), "EEE")}</span>
                  </div>
                </Link>
              ))}
              {projects.length > 5 && <ViewMore to="/execution" label={`+${projects.length - 5} more`} />}
            </Section>
          )}

          {/* Tasks with due_date this week — the work */}
          {tasks.length > 0 && (
            <Section
              icon={<CheckSquare className="h-3.5 w-3.5 text-amber-600" />}
              label="Tasks due"
              count={tasks.length}
            >
              {tasks.slice(0, 6).map((t) => (
                <Link key={t.id} to={`/tasks/${t.id}`} className="block group">
                  <div className="flex items-center gap-2.5 py-1.5 px-2 rounded-md hover:bg-muted/40 transition-colors">
                    <PriorityDot priority={t.priority} />
                    <span className="text-sm text-foreground truncate flex-1 group-hover:text-primary">{t.title}</span>
                    <span className="text-[11px] text-muted-foreground/70 shrink-0">{format(new Date(t.due_date), "EEE")}</span>
                  </div>
                </Link>
              ))}
              {tasks.length > 6 && <ViewMore to="/execution" label={`+${tasks.length - 6} more`} />}
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ icon, label, count, children }: { icon: React.ReactNode; label: string; count: number; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 px-1">
        {icon}
        <h3 className="text-[10px] font-semibold text-muted-foreground/80 uppercase tracking-wider">{label}</h3>
        <span className="text-[10px] text-muted-foreground/50">· {count}</span>
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function ViewMore({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="block py-1 px-2 text-[11px] text-muted-foreground hover:text-foreground">{label}</Link>
  );
}

function PriorityDot({ priority }: { priority: string }) {
  return (
    <span
      className={cn(
        "h-1.5 w-1.5 rounded-full shrink-0",
        priority === "high" ? "bg-red-500" : priority === "low" ? "bg-muted-foreground/30" : "bg-amber-500",
      )}
    />
  );
}
