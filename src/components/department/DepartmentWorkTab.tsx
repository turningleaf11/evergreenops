// DepartmentWorkTab — the "work in flight" surface for a dept.
//
// Two toggles at the top: Projects | Tasks. Each view has filters that match
// what teams actually need to scan:
//   - Projects: status, priority, owner, search
//   - Tasks:    status, priority, assigned-to, search
//
// Click any row → opens the universal MentionPeek drawer (same drawer used
// by @mentions and Today's Focus chips elsewhere in the app).

import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, Folder, CheckSquare, Circle, CircleDot, CheckCircle2, AlertCircle, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMentionPeek } from "@/components/mention-peek/MentionPeekProvider";

// ── Types — match what DepartmentPage already fetches ────────────────────────

interface Project {
  id: string;
  title: string;
  status: string;
  priority: string;
  owner_id?: string | null;
  due_date?: string | null;
  updated_at?: string | null;
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

interface Member {
  user_id: string;
  full_name: string | null;
}

interface Props {
  projects: Project[];
  tasks: Task[];
  members: Member[];
  currentUserId: string | undefined;
  getName: (uid: string | null) => string | null;
}

// ── Status / priority visual maps ────────────────────────────────────────────

const PROJECT_STATUS_COLORS: Record<string, string> = {
  not_started: "bg-muted text-muted-foreground",
  in_progress: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  blocked:     "bg-red-500/15 text-red-700 dark:text-red-400",
  at_risk:     "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  completed:   "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
};

const TASK_STATUS_ICON: Record<string, any> = {
  todo:        Circle,
  in_progress: CircleDot,
  done:        CheckCircle2,
  blocked:     AlertCircle,
};

const TASK_STATUS_COLOR: Record<string, string> = {
  todo:        "text-muted-foreground",
  in_progress: "text-blue-500",
  done:        "text-emerald-500",
  blocked:     "text-red-500",
};

const PRIORITY_COLORS: Record<string, string> = {
  low:    "bg-muted text-muted-foreground",
  medium: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  high:   "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  urgent: "bg-red-500/15 text-red-700 dark:text-red-400",
};

// ── Reusable filter bar ──────────────────────────────────────────────────────

function FilterBar({
  search, setSearch,
  status, setStatus, statusOptions,
  priority, setPriority,
  person, setPerson, members, personLabel = "Owner",
}: {
  search: string; setSearch: (v: string) => void;
  status: string; setStatus: (v: string) => void; statusOptions: Array<{ value: string; label: string }>;
  priority: string; setPriority: (v: string) => void;
  person: string; setPerson: (v: string) => void; members: Member[]; personLabel?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by title..."
          className="pl-8 h-8 text-sm"
        />
      </div>
      <Select value={status} onValueChange={setStatus}>
        <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__all">All statuses</SelectItem>
          {statusOptions.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={priority} onValueChange={setPriority}>
        <SelectTrigger className="h-8 w-[120px] text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__all">All priorities</SelectItem>
          <SelectItem value="urgent">Urgent</SelectItem>
          <SelectItem value="high">High</SelectItem>
          <SelectItem value="medium">Medium</SelectItem>
          <SelectItem value="low">Low</SelectItem>
        </SelectContent>
      </Select>
      <Select value={person} onValueChange={setPerson}>
        <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__all">All {personLabel.toLowerCase()}s</SelectItem>
          <SelectItem value="__me">Me</SelectItem>
          {members.map((m) => (
            <SelectItem key={m.user_id} value={m.user_id}>{m.full_name || "Unnamed"}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// ── Projects view ────────────────────────────────────────────────────────────

function ProjectsList({ projects, members, currentUserId, getName }: {
  projects: Project[];
  members: Member[];
  currentUserId: string | undefined;
  getName: (uid: string | null) => string | null;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("__all");
  const [priority, setPriority] = useState("__all");
  const [owner, setOwner] = useState("__all");
  const { openPeek } = useMentionPeek();

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      if (search.trim() && !p.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (status !== "__all" && p.status !== status) return false;
      if (priority !== "__all" && p.priority !== priority) return false;
      if (owner === "__me") { if (p.owner_id !== currentUserId) return false; }
      else if (owner !== "__all" && p.owner_id !== owner) return false;
      return true;
    });
  }, [projects, search, status, priority, owner, currentUserId]);

  return (
    <div className="space-y-3">
      <FilterBar
        search={search} setSearch={setSearch}
        status={status} setStatus={setStatus}
        statusOptions={[
          { value: "not_started", label: "Not started" },
          { value: "in_progress", label: "In progress" },
          { value: "at_risk",     label: "At risk" },
          { value: "blocked",     label: "Blocked" },
          { value: "completed",   label: "Completed" },
        ]}
        priority={priority} setPriority={setPriority}
        person={owner} setPerson={setOwner} members={members} personLabel="Owner"
      />

      <div className="text-[10px] text-muted-foreground/70 pl-1">
        {filtered.length} of {projects.length} {projects.length === 1 ? "project" : "projects"}
      </div>

      {filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center space-y-1">
            <Folder className="h-6 w-6 mx-auto text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No projects match these filters.</p>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-1.5">
          {filtered.map((p) => {
            const ownerName = getName(p.owner_id);
            return (
              <li key={p.id}>
                <button
                  onClick={() => openPeek("project", p.id)}
                  className="w-full flex items-center gap-3 py-2.5 px-3 rounded-lg border border-border/40 bg-card hover:border-border hover:bg-muted/30 transition-colors text-left"
                >
                  <Folder className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium truncate flex-1">{p.title}</span>
                  <Badge variant="secondary" className={cn("text-[9px] shrink-0 border-0", PROJECT_STATUS_COLORS[p.status])}>
                    {p.status.replace(/_/g, " ")}
                  </Badge>
                  <Badge variant="secondary" className={cn("text-[9px] shrink-0 border-0", PRIORITY_COLORS[p.priority])}>
                    {p.priority}
                  </Badge>
                  {p.due_date && (
                    <span className="text-[10px] text-muted-foreground shrink-0 inline-flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> {p.due_date}
                    </span>
                  )}
                  {ownerName && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Avatar className="h-5 w-5">
                        <AvatarFallback className="text-[9px] bg-muted">
                          {ownerName.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ── Tasks view ───────────────────────────────────────────────────────────────

function TasksList({ tasks, members, currentUserId, getName }: {
  tasks: Task[];
  members: Member[];
  currentUserId: string | undefined;
  getName: (uid: string | null) => string | null;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("__all");
  const [priority, setPriority] = useState("__all");
  const [assignee, setAssignee] = useState("__all");
  const { openPeek } = useMentionPeek();

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (search.trim() && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (status !== "__all" && t.status !== status) return false;
      if (priority !== "__all" && t.priority !== priority) return false;
      if (assignee === "__me") { if (t.assigned_to !== currentUserId) return false; }
      else if (assignee !== "__all" && t.assigned_to !== assignee) return false;
      return true;
    });
  }, [tasks, search, status, priority, assignee, currentUserId]);

  return (
    <div className="space-y-3">
      <FilterBar
        search={search} setSearch={setSearch}
        status={status} setStatus={setStatus}
        statusOptions={[
          { value: "todo",        label: "To do" },
          { value: "in_progress", label: "In progress" },
          { value: "blocked",     label: "Blocked" },
          { value: "done",        label: "Done" },
        ]}
        priority={priority} setPriority={setPriority}
        person={assignee} setPerson={setAssignee} members={members} personLabel="Assignee"
      />

      <div className="text-[10px] text-muted-foreground/70 pl-1">
        {filtered.length} of {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
      </div>

      {filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center space-y-1">
            <CheckSquare className="h-6 w-6 mx-auto text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No tasks match these filters.</p>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-1">
          {filtered.map((t) => {
            const StatusIcon = TASK_STATUS_ICON[t.status] ?? Circle;
            const assigneeName = getName(t.assigned_to ?? null);
            return (
              <li key={t.id}>
                <button
                  onClick={() => openPeek("task", t.id)}
                  className="w-full flex items-center gap-3 py-2 px-3 rounded-md hover:bg-muted/40 transition-colors text-left"
                >
                  <StatusIcon className={cn("h-3.5 w-3.5 shrink-0", TASK_STATUS_COLOR[t.status])} />
                  <span className="text-sm truncate flex-1">{t.title}</span>
                  <Badge variant="secondary" className={cn("text-[9px] shrink-0 border-0", PRIORITY_COLORS[t.priority])}>
                    {t.priority}
                  </Badge>
                  {t.due_date && (
                    <span className="text-[10px] text-muted-foreground shrink-0">{t.due_date}</span>
                  )}
                  {assigneeName && (
                    <Avatar className="h-5 w-5 shrink-0">
                      <AvatarFallback className="text-[9px] bg-muted">
                        {assigneeName.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ── Composer ─────────────────────────────────────────────────────────────────

export function DepartmentWorkTab(props: Props) {
  const [view, setView] = useState<"projects" | "tasks">("projects");

  return (
    <div className="space-y-4">
      {/* Sub-tab toggle */}
      <div className="inline-flex rounded-lg border border-border/60 p-0.5 bg-muted/30">
        <button
          onClick={() => setView("projects")}
          className={cn(
            "px-3.5 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5",
            view === "projects" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Folder className="h-3.5 w-3.5" /> Projects
          <span className="text-[10px] text-muted-foreground">· {props.projects.length}</span>
        </button>
        <button
          onClick={() => setView("tasks")}
          className={cn(
            "px-3.5 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5",
            view === "tasks" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <CheckSquare className="h-3.5 w-3.5" /> Tasks
          <span className="text-[10px] text-muted-foreground">· {props.tasks.length}</span>
        </button>
      </div>

      {view === "projects"
        ? <ProjectsList projects={props.projects} members={props.members} currentUserId={props.currentUserId} getName={props.getName} />
        : <TasksList    tasks={props.tasks}       members={props.members} currentUserId={props.currentUserId} getName={props.getName} />
      }
    </div>
  );
}
