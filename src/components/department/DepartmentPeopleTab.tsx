// DepartmentPeopleTab — enriched team roster.
//
// Each person card shows:
//   - Avatar + name + title
//   - "Leader" badge when applicable
//   - "Reports to" line if profile.reports_to is set
//   - Live work load: active task count + active project count
//
// Click a card → opens the universal MentionPeek drawer (person peek).
//
// Pure presentation — all data comes pre-fetched from DepartmentPage so we
// don't duplicate queries.

import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Users, CheckSquare, Folder, ChevronRight } from "lucide-react";
import { useMentionPeek } from "@/components/mention-peek/MentionPeekProvider";
import { EmptyState } from "@/components/shared/EmptyState";
import { cn } from "@/lib/utils";

interface Profile {
  user_id: string;
  full_name: string | null;
  avatar_url?: string | null;
  title?: string | null;
  reports_to?: string | null;
  is_leader?: boolean;
}

interface Task { id: string; assigned_to?: string | null; status: string; }
interface Project { id: string; owner_id?: string | null; status: string; }

interface Props {
  members: Profile[];
  /** Full profile list used to resolve reports_to → manager name. */
  allProfiles: Profile[];
  tasks: Task[];
  projects: Project[];
  deptColor: string;
  onNavigateToPeople: () => void;
}

// "Active" means not in a terminal state. Mirrors the rest of the dept page.
const isActiveTask    = (t: Task)    => t.status !== "done"      && t.status !== "archived";
const isActiveProject = (p: Project) => p.status !== "completed" && p.status !== "archived";

export function DepartmentPeopleTab({
  members, allProfiles, tasks, projects, deptColor, onNavigateToPeople,
}: Props) {
  const { openPeek } = useMentionPeek();

  // Index profiles by user_id for fast reports_to resolution.
  const profileIndex = useMemo(() => {
    const m = new Map<string, Profile>();
    for (const p of allProfiles) m.set(p.user_id, p);
    return m;
  }, [allProfiles]);

  // Pre-compute work load per person — one pass instead of N filters.
  const loadByUser = useMemo(() => {
    const out = new Map<string, { tasks: number; projects: number }>();
    for (const t of tasks) {
      if (!t.assigned_to || !isActiveTask(t)) continue;
      const cur = out.get(t.assigned_to) ?? { tasks: 0, projects: 0 };
      cur.tasks += 1;
      out.set(t.assigned_to, cur);
    }
    for (const p of projects) {
      if (!p.owner_id || !isActiveProject(p)) continue;
      const cur = out.get(p.owner_id) ?? { tasks: 0, projects: 0 };
      cur.projects += 1;
      out.set(p.owner_id, cur);
    }
    return out;
  }, [tasks, projects]);

  // Sort: leaders first (alpha), then everyone else (alpha).
  const sortedMembers = useMemo(() => {
    return [...members].sort((a, b) => {
      const la = a.is_leader ? 0 : 1;
      const lb = b.is_leader ? 0 : 1;
      if (la !== lb) return la - lb;
      return (a.full_name ?? "").localeCompare(b.full_name ?? "");
    });
  }, [members]);

  if (sortedMembers.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No team members yet"
        description="Assign people to this department from the People page so they show up here with their work load and reporting structure."
        actionLabel="Go to People"
        actionIcon={Users}
        onAction={onNavigateToPeople}
      />
    );
  }

  const teamTotalTasks    = sortedMembers.reduce((s, m) => s + (loadByUser.get(m.user_id)?.tasks ?? 0), 0);
  const teamTotalProjects = sortedMembers.reduce((s, m) => s + (loadByUser.get(m.user_id)?.projects ?? 0), 0);

  return (
    <div className="space-y-4">
      {/* Team load header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Users className="h-4 w-4" /> People <span className="text-[10px] text-muted-foreground/70">· {sortedMembers.length}</span>
        </h2>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <CheckSquare className="h-3 w-3" />
            {teamTotalTasks} active {teamTotalTasks === 1 ? "task" : "tasks"}
          </span>
          <span className="inline-flex items-center gap-1">
            <Folder className="h-3 w-3" />
            {teamTotalProjects} active {teamTotalProjects === 1 ? "project" : "projects"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {sortedMembers.map((m) => {
          const load = loadByUser.get(m.user_id) ?? { tasks: 0, projects: 0 };
          const manager = m.reports_to ? profileIndex.get(m.reports_to) : null;
          const initials = (m.full_name || "U").split(" ").map((n) => n[0]).join("").slice(0, 2);

          return (
            <button
              key={m.user_id}
              onClick={() => openPeek("person", m.user_id)}
              className="text-left group"
            >
              <Card className="hover:border-border transition-colors h-full">
                <CardContent className="p-4 space-y-3">
                  {/* Header: avatar + name + chevron */}
                  <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarFallback
                        className="text-xs"
                        style={{ background: `hsl(${deptColor} / 0.18)`, color: `hsl(${deptColor})` }}
                      >
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-medium text-sm truncate">{m.full_name || "Unnamed"}</p>
                        {m.is_leader && (
                          <Badge
                            variant="secondary"
                            className="text-[9px] uppercase tracking-wider border-0 shrink-0"
                            style={{ background: `hsl(${deptColor} / 0.18)`, color: `hsl(${deptColor})` }}
                          >
                            Lead
                          </Badge>
                        )}
                      </div>
                      {m.title && <p className="text-[11px] text-muted-foreground truncate">{m.title}</p>}
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0 mt-1" />
                  </div>

                  {/* Reports to */}
                  {manager && (
                    <div className="text-[11px] text-muted-foreground border-t border-border/40 pt-2.5">
                      Reports to <span className="font-medium text-foreground/80">{manager.full_name || "Unnamed"}</span>
                    </div>
                  )}

                  {/* Work load */}
                  <div className={cn("flex items-center gap-3 text-[11px]", !manager && "border-t border-border/40 pt-2.5")}>
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <CheckSquare className="h-3 w-3" />
                      <span className={cn(load.tasks > 0 && "font-medium text-foreground/80")}>
                        {load.tasks}
                      </span>
                      {load.tasks === 1 ? "task" : "tasks"}
                    </span>
                    <span className="text-border">·</span>
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Folder className="h-3 w-3" />
                      <span className={cn(load.projects > 0 && "font-medium text-foreground/80")}>
                        {load.projects}
                      </span>
                      {load.projects === 1 ? "project" : "projects"}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </button>
          );
        })}
      </div>
    </div>
  );
}
