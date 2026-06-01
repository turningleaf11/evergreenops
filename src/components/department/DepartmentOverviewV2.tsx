// DepartmentOverviewV2 — the universal "what's next" surface for any dept.
//
// Five blocks in a fixed spine, ordered per viewer role:
//
//   1. Today's Focus  — Albus-synthesized 1-3 priorities for THIS week.
//                       (Placeholder in this PR; live in PR 2B.)
//   2. My Queue       — what's on the viewer's personal plate from this dept.
//   3. Goals          — what success looks like this quarter.
//   4. Stuck          — items that need a decision or are blocked.
//   5. Team           — who's on the dept (condensed roster).
//
// The block STRUCTURE is identical for every dept type. The template
// (sales / operations / portfolio / creative / etc.) only changes the
// rules INSIDE each block (what counts as a queue item, what flags as
// stuck, what KPI strip appears). Adding a new dept type → no UI change.

import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Target, Flame, AlertCircle, Users, Sparkles, ArrowRight,
  CircleDot, Clock, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { DeptTemplate } from "@/hooks/useDeptTemplate";

// ── Shared types ─────────────────────────────────────────────────────────────

interface Goal {
  id: string;
  title: string;
  progress: number;
  status: string;
  deadline?: string | null;
}

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  project_id?: string | null;
  assigned_to?: string | null;
  due_date?: string | null;
  updated_at?: string | null;
}

interface Project {
  id: string;
  title: string;
  status: string;
  priority: string;
  owner_id?: string | null;
  due_date?: string | null;
  updated_at?: string | null;
}

interface Issue {
  id: string;
  title: string;
  status: string;
  priority: number;
}

interface Member {
  user_id: string;
  full_name: string | null;
  avatar_url?: string | null;
}

export type ViewerRole = "member" | "leader" | "admin";

interface Props {
  deptName: string;
  deptId: string;
  deptColor: string;
  template: DeptTemplate | null;
  viewerRole: ViewerRole;
  currentUserId: string | undefined;
  goals: Goal[];
  tasks: Task[];
  projects: Project[];
  issues: Issue[];
  members: Member[];
  getName: (uid: string | null) => string | null;
  onTaskClick: (t: Task) => void;
  onProjectClick: (p: Project) => void;
}

// ── Block: Today's Focus (placeholder until PR 2B) ───────────────────────────

function TodaysFocusBlock({ template, deptColor }: { template: DeptTemplate | null; deptColor: string }) {
  return (
    <Card className="overflow-hidden border-2" style={{ borderColor: `hsl(${deptColor} / 0.35)` }}>
      <div className="h-1" style={{ background: `hsl(${deptColor})` }} />
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" style={{ color: `hsl(${deptColor})` }} />
          <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">Today's Focus</h2>
          <Badge variant="secondary" className="text-[9px] uppercase tracking-wider">
            From Albus
          </Badge>
        </div>
        <div className="rounded-lg border border-dashed border-border/60 bg-muted/30 p-6 text-center space-y-2">
          <Sparkles className="h-5 w-5 mx-auto text-muted-foreground/40" />
          <p className="text-sm text-foreground/80">Albus hasn't generated this week's focus yet.</p>
          <p className="text-xs text-muted-foreground/70">
            In the next update, Albus will synthesize 1-3 priorities for this team based on your goals,
            active work, and recent activity — with links to the specific tasks and projects involved.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Block: My Queue ──────────────────────────────────────────────────────────

function MyQueueBlock({
  tasks, projects, currentUserId, onTaskClick, onProjectClick,
}: {
  tasks: Task[];
  projects: Project[];
  currentUserId: string | undefined;
  onTaskClick: (t: Task) => void;
  onProjectClick: (p: Project) => void;
}) {
  const myItems = useMemo(() => {
    if (!currentUserId) return [];
    const mine: Array<{ kind: "task" | "project"; item: Task | Project }> = [];
    for (const t of tasks) if (t.assigned_to === currentUserId) mine.push({ kind: "task", item: t });
    for (const p of projects) if (p.owner_id === currentUserId) mine.push({ kind: "project", item: p });
    // Sort by priority (urgent > high > medium > low), then due date if present
    const order: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
    mine.sort((a, b) => (order[a.item.priority] ?? 9) - (order[b.item.priority] ?? 9));
    return mine.slice(0, 8);
  }, [tasks, projects, currentUserId]);

  return (
    <Card>
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-foreground/80" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">My Queue</h2>
          {myItems.length > 0 && (
            <span className="text-[10px] text-muted-foreground">· {myItems.length}</span>
          )}
        </div>
        {myItems.length === 0 ? (
          <p className="text-sm text-muted-foreground/70 italic">Nothing assigned to you in this department.</p>
        ) : (
          <ul className="space-y-1">
            {myItems.map(({ kind, item }) => (
              <li key={`${kind}-${item.id}`}>
                <button
                  onClick={() => kind === "task" ? onTaskClick(item as Task) : onProjectClick(item as Project)}
                  className="w-full flex items-center gap-2.5 py-1.5 px-2 rounded-md hover:bg-muted transition-colors text-left text-sm"
                >
                  {kind === "task" ? (
                    <CircleDot className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  ) : (
                    <Target className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  )}
                  <span className="truncate flex-1">{item.title}</span>
                  <Badge variant="secondary" className="text-[9px] shrink-0">
                    {item.priority}
                  </Badge>
                  <Badge variant="outline" className="text-[9px] uppercase shrink-0 tracking-wider">
                    {kind}
                  </Badge>
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ── Block: Goals ─────────────────────────────────────────────────────────────

function GoalsBlock({ goals, deptColor }: { goals: Goal[]; deptColor: string }) {
  const active = useMemo(
    () => goals.filter((g) => g.status !== "completed").slice(0, 3),
    [goals],
  );

  return (
    <Card>
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-foreground/80" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">Goals This Quarter</h2>
          </div>
          <Link to="/execution" className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5">
            View all <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
        {active.length === 0 ? (
          <p className="text-sm text-muted-foreground/70 italic">No active goals for this dept this quarter.</p>
        ) : (
          <ul className="space-y-2.5">
            {active.map((g) => (
              <li key={g.id} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium truncate flex-1">{g.title}</span>
                  <span className="text-[11px] text-muted-foreground shrink-0">{g.progress}%</span>
                </div>
                <Progress
                  value={g.progress}
                  className="h-1.5"
                  style={{ ['--progress-foreground' as any]: `hsl(${deptColor})` }}
                />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ── Block: Stuck ─────────────────────────────────────────────────────────────

function StuckBlock({
  tasks, projects, issues, template, onTaskClick, onProjectClick,
}: {
  tasks: Task[];
  projects: Project[];
  issues: Issue[];
  template: DeptTemplate | null;
  onTaskClick: (t: Task) => void;
  onProjectClick: (p: Project) => void;
}) {
  // Apply template stuck rules. For now: support task_overdue + project_stale.
  // Future templates can declare custom rule types; we just ignore unknown rules.
  const stuck = useMemo(() => {
    const out: Array<{ kind: "task" | "project" | "issue"; item: any; reason: string }> = [];
    const now = Date.now();
    const rules = template?.config?.stuck_rules ?? [];

    for (const rule of rules) {
      if (rule.type === "task_overdue") {
        const days = rule.days ?? 3;
        const cutoff = now - days * 86400000;
        for (const t of tasks) {
          if (t.due_date && new Date(t.due_date).getTime() < now - days * 86400000) {
            out.push({ kind: "task", item: t, reason: `Overdue >${days}d` });
          } else if (!t.due_date && t.updated_at && new Date(t.updated_at).getTime() < cutoff) {
            // No due date, not touched in N days — also stuck.
            out.push({ kind: "task", item: t, reason: `No update >${days}d` });
          }
        }
      } else if (rule.type === "project_stale") {
        const days = rule.days ?? 14;
        const cutoff = now - days * 86400000;
        for (const p of projects) {
          if (p.updated_at && new Date(p.updated_at).getTime() < cutoff && p.status !== "completed") {
            out.push({ kind: "project", item: p, reason: `Stale >${days}d` });
          }
        }
      }
    }

    // Open issues are inherently "stuck items" worth surfacing.
    for (const i of issues) {
      out.push({ kind: "issue", item: i, reason: `P${i.priority} issue` });
    }

    // Dedupe by (kind, id) — a task could match multiple rules.
    const seen = new Set<string>();
    const deduped = out.filter((x) => {
      const k = `${x.kind}-${x.item.id}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    return deduped.slice(0, 6);
  }, [tasks, projects, issues, template]);

  return (
    <Card className={stuck.length > 0 ? "border-amber-500/30" : ""}>
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center gap-2">
          <AlertCircle className={cn("h-4 w-4", stuck.length > 0 ? "text-amber-500" : "text-foreground/80")} />
          <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">Stuck / Needs Decision</h2>
          {stuck.length > 0 && (
            <span className="text-[10px] text-amber-700 dark:text-amber-400">· {stuck.length}</span>
          )}
        </div>
        {stuck.length === 0 ? (
          <p className="text-sm text-muted-foreground/70 italic">Nothing flagged — clear runway.</p>
        ) : (
          <ul className="space-y-1">
            {stuck.map(({ kind, item, reason }) => (
              <li key={`${kind}-${item.id}`}>
                {kind === "issue" ? (
                  <Link
                    to="/issues"
                    className="w-full flex items-center gap-2.5 py-1.5 px-2 rounded-md hover:bg-muted transition-colors text-sm"
                  >
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                    <span className="truncate flex-1">{item.title}</span>
                    <Badge variant="secondary" className="text-[9px] shrink-0 bg-amber-500/15 text-amber-700 dark:text-amber-400">
                      {reason}
                    </Badge>
                  </Link>
                ) : (
                  <button
                    onClick={() => kind === "task" ? onTaskClick(item as Task) : onProjectClick(item as Project)}
                    className="w-full flex items-center gap-2.5 py-1.5 px-2 rounded-md hover:bg-muted transition-colors text-left text-sm"
                  >
                    <Clock className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                    <span className="truncate flex-1">{item.title}</span>
                    <Badge variant="secondary" className="text-[9px] shrink-0">
                      {reason}
                    </Badge>
                    <Badge variant="outline" className="text-[9px] uppercase shrink-0 tracking-wider">
                      {kind}
                    </Badge>
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ── Block: Team ──────────────────────────────────────────────────────────────

function TeamBlock({ members, deptColor }: { members: Member[]; deptColor: string }) {
  return (
    <Card>
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-foreground/80" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">Team</h2>
            <span className="text-[10px] text-muted-foreground">· {members.length}</span>
          </div>
        </div>
        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground/70 italic">No team members yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {members.map((m) => (
              <div key={m.user_id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-muted/50">
                <Avatar className="h-5 w-5 shrink-0">
                  <AvatarFallback className="text-[9px]" style={{ background: `hsl(${deptColor} / 0.25)` }}>
                    {(m.full_name || "U").split(" ").map((n) => n[0]).join("").slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs">{m.full_name || "Unnamed"}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Composer: role-aware ordering ────────────────────────────────────────────

export function DepartmentOverviewV2(props: Props) {
  const { viewerRole, template, deptColor } = props;

  // Role-aware first-row ordering.
  // - Member  → "what's on MY plate" first
  // - Leader  → "what should the team focus on" first
  // - Admin   → "where am I a bottleneck" first
  const blockOrder: Array<"focus" | "queue" | "goals" | "stuck" | "team"> =
    viewerRole === "member" ? ["queue", "focus", "goals", "stuck", "team"]
    : viewerRole === "leader" ? ["focus", "stuck", "goals", "queue", "team"]
    :                            ["stuck", "focus", "goals", "queue", "team"];

  const blocks: Record<string, JSX.Element> = {
    focus: <TodaysFocusBlock key="focus" template={template} deptColor={deptColor} />,
    queue: <MyQueueBlock key="queue" tasks={props.tasks} projects={props.projects} currentUserId={props.currentUserId} onTaskClick={props.onTaskClick} onProjectClick={props.onProjectClick} />,
    goals: <GoalsBlock key="goals" goals={props.goals} deptColor={deptColor} />,
    stuck: <StuckBlock key="stuck" tasks={props.tasks} projects={props.projects} issues={props.issues} template={template} onTaskClick={props.onTaskClick} onProjectClick={props.onProjectClick} />,
    team:  <TeamBlock key="team" members={props.members} deptColor={deptColor} />,
  };

  return (
    <div className="space-y-4">
      {/* Template badge — small chip so you can see at a glance which template this dept is on */}
      {template && (
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground/70">
          <span className="uppercase tracking-widest">Template</span>
          <Badge variant="outline" className="text-[10px]">{template.name}</Badge>
        </div>
      )}

      {blockOrder.map((k) => blocks[k])}
    </div>
  );
}
