import { useEffect, useState } from "react";
import {
  Sparkles, CheckCircle2, Clock, AlertCircle, Play,
  Activity, Plus, Loader2, Calendar,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";

type Status = "backlog" | "pending" | "doing" | "needs_input" | "done" | "cancelled";
type Priority = "low" | "normal" | "high" | "urgent";

interface AgentTask {
  id: string;
  title: string;
  description: string;
  assigned_to: string;
  status: Status;
  priority: Priority;
  context: Record<string, unknown> | null;
  result: string | null;
  error: string | null;
  created_by: string | null;
  due_date: string | null;
  deferred_until: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
}

interface Agent {
  id: string;
  name: string;
  slug: string;
  emoji: string;
  avatar_url: string | null;
  subtitle: string | null;
  role: string | null;
  status: string;
  accent_color: string | null;
}

interface HumanProfile {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
}

type Assignee = {
  key: string;           // slug for agents, user_id for humans
  name: string;
  subtitle: string | null;
  emoji: string | null;
  avatar_url: string | null;
  status: string;
  kind: "agent" | "human";
  accent_color: string | null;
};

const STATUS_DOT: Record<string, string> = {
  active:  "bg-green-400",
  idle:    "bg-yellow-400",
  offline: "bg-slate-400",
  error:   "bg-red-400",
  online:  "bg-green-400",
};

const COLUMNS: { key: Status; label: string; color: string; icon: React.ReactNode }[] = [
  { key: "backlog",     label: "Backlog",     color: "border-slate-400",  icon: <Clock className="h-3.5 w-3.5 text-slate-400" /> },
  { key: "pending",     label: "Pending",     color: "border-blue-400",   icon: <Clock className="h-3.5 w-3.5 text-blue-400" /> },
  { key: "doing",       label: "Doing",       color: "border-yellow-400", icon: <Play className="h-3.5 w-3.5 text-yellow-400" /> },
  { key: "needs_input", label: "Needs Input", color: "border-purple-400", icon: <AlertCircle className="h-3.5 w-3.5 text-purple-400" /> },
  { key: "done",        label: "Done",        color: "border-green-400",  icon: <CheckCircle2 className="h-3.5 w-3.5 text-green-400" /> },
  { key: "cancelled",   label: "Cancelled",   color: "border-slate-600",  icon: <AlertCircle className="h-3.5 w-3.5 text-slate-500" /> },
];

const PRIORITY_BADGE: Record<Priority, string> = {
  urgent: "bg-red-100 text-red-800 border-red-200",
  high:   "bg-orange-100 text-orange-800 border-orange-200",
  normal: "bg-blue-100 text-blue-800 border-blue-200",
  low:    "bg-slate-100 text-slate-700 border-slate-200",
};

const AVATAR_COLORS = ["#6366f1","#f59e0b","#10b981","#06b6d4","#f43f5e","#a78bfa","#34d399","#60a5fa"];
const colorFor = (s: string) => AVATAR_COLORS[Math.abs(s.split("").reduce((a, c) => a + c.charCodeAt(0), 0)) % AVATAR_COLORS.length];
const initials = (name: string) => name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);

function AssigneeAvatar({ assignee, size = "sm" }: { assignee: Assignee | undefined; size?: "sm" | "md" }) {
  const sz = size === "sm" ? "h-6 w-6 text-[10px]" : "h-8 w-8 text-xs";
  if (!assignee) return (
    <span className={`flex items-center justify-center rounded-full border border-border bg-secondary text-muted-foreground ${sz}`}>?</span>
  );
  if (assignee.avatar_url) return (
    <img src={assignee.avatar_url} alt={assignee.name} className={`rounded-full object-cover ${sz}`} />
  );
  const bg = assignee.accent_color ?? colorFor(assignee.name);
  return (
    <span className={`flex items-center justify-center rounded-full font-semibold text-white ${sz}`} style={{ background: bg }}>
      {assignee.emoji ?? initials(assignee.name)}
    </span>
  );
}

export default function AiHubPage() {
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<AgentTask | null>(null);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("tasks");

  const fetchAll = async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    const [tasksRes, agentsRes, profilesRes] = await Promise.all([
      supabase.from("agent_tasks").select("*").order("created_at", { ascending: false }),
      supabase.from("agents").select("id,name,slug,emoji,avatar_url,subtitle,role,status,accent_color").order("position"),
      supabase.from("profiles").select("user_id,full_name,avatar_url"),
    ]);

    if (tasksRes.error) toast({ title: "Failed to load tasks", description: tasksRes.error.message, variant: "destructive" });
    else setTasks((tasksRes.data ?? []) as AgentTask[]);

    const agentList: Assignee[] = (agentsRes.data ?? []).map((a: Agent) => ({
      key: a.slug, name: a.name, subtitle: a.subtitle ?? a.role, emoji: a.emoji,
      avatar_url: a.avatar_url, status: a.status, kind: "agent", accent_color: a.accent_color,
    }));
    const humanList: Assignee[] = (profilesRes.data ?? []).map((p: HumanProfile) => ({
      key: p.user_id, name: p.full_name ?? "Human", subtitle: "Team member", emoji: null,
      avatar_url: p.avatar_url, status: "online", kind: "human", accent_color: null,
    }));
    setAssignees([...agentList, ...humanList]);
    setLoading(false);
  };

  useEffect(() => {
    fetchAll(true);
    const channel = supabase
      .channel("ai-hub-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "agent_tasks" }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "agents" }, fetchAll)
      .subscribe((status) => console.log("[AI Hub realtime]", status));
    const poll = setInterval(fetchAll, 5000);
    return () => { supabase.removeChannel(channel); clearInterval(poll); };
  }, []);

  const findAssignee = (key: string) => assignees.find(a => a.key === key);
  const tasksByStatus = (status: Status) => tasks.filter(t => t.status === status);

  const stats = {
    pending: tasksByStatus("pending").length + tasksByStatus("backlog").length,
    doing: tasksByStatus("doing").length,
    done: tasksByStatus("done").length,
    needsInput: tasksByStatus("needs_input").length,
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> AI Hub
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Agent task board</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchAll}>
            <Activity className="h-4 w-4 mr-2" /> Refresh
          </Button>
          <Button size="sm" onClick={() => setNewTaskOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> New Task
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Queued",      value: stats.pending,    color: "bg-blue-100",   icon: <Clock className="h-5 w-5 text-blue-600" /> },
          { label: "In Progress", value: stats.doing,      color: "bg-yellow-100", icon: <Play className="h-5 w-5 text-yellow-600" /> },
          { label: "Needs Input", value: stats.needsInput, color: "bg-purple-100", icon: <AlertCircle className="h-5 w-5 text-purple-600" /> },
          { label: "Done",        value: stats.done,       color: "bg-green-100",  icon: <CheckCircle2 className="h-5 w-5 text-green-600" /> },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className={`p-2 ${s.color} rounded-lg`}>{s.icon}</div>
                <div>
                  <p className="text-2xl font-bold">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="agents">Agents</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading…
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {COLUMNS.map(col => {
                const colTasks = tasksByStatus(col.key);
                return (
                  <div key={col.key} className="flex flex-col gap-2">
                    <div className={`flex items-center gap-2 rounded-lg border-l-4 ${col.color} bg-card px-3 py-2`}>
                      {col.icon}
                      <span className="text-sm font-semibold">{col.label}</span>
                      {col.key === "doing" && colTasks.length > 0 && (
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500" />
                        </span>
                      )}
                      <span className="ml-auto rounded-full bg-secondary px-2 py-0.5 text-[11px] font-mono">{colTasks.length}</span>
                    </div>
                    <div className="flex flex-col gap-2 max-h-[65vh] overflow-y-auto">
                      {colTasks.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-border/50 p-4 text-center text-xs text-muted-foreground">No tasks</div>
                      ) : colTasks.map(task => (
                        <TaskCard key={task.id} task={task} assignee={findAssignee(task.assigned_to)} onClick={() => setSelectedTask(task)} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="agents" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {assignees.filter(a => a.kind === "agent").map(agent => (
              <Card key={agent.key}>
                <CardContent className="pt-5">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <AssigneeAvatar assignee={agent} size="md" />
                      <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background ${STATUS_DOT[agent.status] ?? "bg-slate-400"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{agent.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{agent.subtitle}</p>
                    </div>
                    <Badge variant={agent.status === "active" ? "default" : "secondary"} className="text-xs capitalize">{agent.status}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <Card>
            <CardContent className="pt-6 space-y-3">
              {tasks.filter(t => t.status === "done" || t.status === "doing").slice(0, 20).map(task => {
                const assignee = findAssignee(task.assigned_to);
                return (
                  <div key={task.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="relative shrink-0 mt-0.5">
                      <AssigneeAvatar assignee={assignee} size="sm" />
                      <span className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-background ${task.status === "doing" ? "bg-yellow-400" : "bg-green-400"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{task.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">{assignee?.name ?? task.assigned_to}</span>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs text-muted-foreground">
                          {task.completed_at ? format(parseISO(task.completed_at), "MMM d, h:mm a")
                            : task.started_at ? format(parseISO(task.started_at), "MMM d, h:mm a")
                            : format(parseISO(task.created_at), "MMM d, h:mm a")}
                        </span>
                      </div>
                      {task.result && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{task.result}</p>}
                    </div>
                  </div>
                );
              })}
              {tasks.filter(t => t.status === "done" || t.status === "doing").length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-8">No activity yet.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {selectedTask && (
        <TaskDetailDialog
          task={selectedTask}
          assignees={assignees}
          onClose={() => setSelectedTask(null)}
          onRefresh={fetchAll}
        />
      )}

      <NewTaskDialog open={newTaskOpen} onOpenChange={setNewTaskOpen} assignees={assignees} onCreated={fetchAll} />
    </div>
  );
}

const TaskCard = ({ task, assignee, onClick }: { task: AgentTask; assignee: Assignee | undefined; onClick: () => void }) => (
  <div
    onClick={onClick}
    className={`cursor-pointer rounded-lg border bg-card p-3 transition-all space-y-2.5 ${
      task.status === "doing"
        ? "border-yellow-400/70 ring-2 ring-yellow-400/20 shadow-[0_0_14px_3px_rgba(250,204,21,0.12)] hover:border-yellow-400"
        : "border-border/60 hover:border-primary/40"
    }`}
  >
    <div className="flex items-start justify-between gap-1">
      <p className="text-sm font-medium leading-snug line-clamp-2">{task.title}</p>
      {task.status === "doing" && (
        <Loader2 className="h-3.5 w-3.5 text-yellow-500 animate-spin shrink-0 mt-0.5" />
      )}
    </div>
    <div className="flex items-center gap-2">
      <div className="relative shrink-0">
        <AssigneeAvatar assignee={assignee} size="sm" />
        {assignee && (
          <span className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-background ${STATUS_DOT[assignee.status] ?? "bg-slate-400"}`} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{assignee?.name ?? task.assigned_to}</p>
        {assignee?.subtitle && <p className="text-[10px] text-muted-foreground truncate">{assignee.subtitle}</p>}
      </div>
      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] capitalize ${PRIORITY_BADGE[task.priority]}`}>
        {task.priority}
      </span>
    </div>
    {task.due_date && (
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <Calendar className="h-3 w-3" />
        {format(parseISO(task.due_date), "MMM d")}
      </div>
    )}
  </div>
);

const AssigneeOption = ({ assignee }: { assignee: Assignee }) => (
  <div className="flex items-center gap-2.5 py-0.5">
    <div className="relative shrink-0">
      <AssigneeAvatar assignee={assignee} size="sm" />
      <span className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-background ${STATUS_DOT[assignee.status] ?? "bg-slate-400"}`} />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium">{assignee.name}</p>
      {assignee.subtitle && <p className="text-xs text-muted-foreground">{assignee.subtitle}</p>}
    </div>
  </div>
);

const TaskDetailDialog = ({
  task, assignees, onClose, onRefresh,
}: { task: AgentTask; assignees: Assignee[]; onClose: () => void; onRefresh: () => void }) => {
  const [status, setStatus] = useState<Status>(task.status);
  const [assignedTo, setAssignedTo] = useState(task.assigned_to);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("agent_tasks").update({ status, assigned_to: assignedTo }).eq("id", task.id);
    if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
    else { toast({ title: "Saved" }); onRefresh(); onClose(); }
    setSaving(false);
  };

  const assignee = assignees.find(a => a.key === assignedTo);

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="pr-8 leading-snug">{task.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={`capitalize ${PRIORITY_BADGE[task.priority]}`}>{task.priority}</Badge>
          </div>

          {task.description && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Description</p>
              <p className="text-sm whitespace-pre-wrap">{task.description}</p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Assigned to</Label>
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger>
                <div className="flex items-center gap-2">
                  {assignee && <AssigneeAvatar assignee={assignee} size="sm" />}
                  <span>{assignee?.name ?? assignedTo}</span>
                </div>
              </SelectTrigger>
              <SelectContent>
                {assignees.filter(a => a.kind === "agent").length > 0 && (
                  <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">Agents</div>
                )}
                {assignees.filter(a => a.kind === "agent").map(a => (
                  <SelectItem key={a.key} value={a.key}>
                    <AssigneeOption assignee={a} />
                  </SelectItem>
                ))}
                {assignees.filter(a => a.kind === "human").length > 0 && (
                  <div className="px-2 py-1 text-xs font-semibold text-muted-foreground mt-1">People</div>
                )}
                {assignees.filter(a => a.kind === "human").map(a => (
                  <SelectItem key={a.key} value={a.key}>
                    <AssigneeOption assignee={a} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={v => setStatus(v as Status)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {COLUMNS.map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {task.result && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Result</p>
              <div className="rounded-lg bg-muted/50 p-3 text-sm whitespace-pre-wrap max-h-48 overflow-y-auto">{task.result}</div>
            </div>
          )}
          {task.error && (
            <div>
              <p className="text-xs font-medium text-red-500 mb-1">Error</p>
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{task.error}</div>
            </div>
          )}
          {task.notes && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Notes</p>
              <p className="text-sm">{task.notes}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <div>Created {format(parseISO(task.created_at), "MMM d, h:mm a")}</div>
            {task.due_date && <div>Due {format(parseISO(task.due_date), "MMM d")}</div>}
            {task.started_at && <div>Started {format(parseISO(task.started_at), "MMM d, h:mm a")}</div>}
            {task.completed_at && <div>Completed {format(parseISO(task.completed_at), "MMM d, h:mm a")}</div>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const NewTaskDialog = ({
  open, onOpenChange, assignees, onCreated,
}: { open: boolean; onOpenChange: (v: boolean) => void; assignees: Assignee[]; onCreated: () => void }) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignedTo, setAssignedTo] = useState("claude");
  const [priority, setPriority] = useState<Priority>("normal");
  const [status, setStatus] = useState<Status>("pending");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => { setTitle(""); setDescription(""); setAssignedTo("claude"); setPriority("normal"); setStatus("pending"); setDueDate(""); };

  const create = async () => {
    if (!title.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("agent_tasks").insert({
      title: title.trim(),
      description: description.trim() || title.trim(),
      assigned_to: assignedTo,
      priority, status,
      due_date: dueDate || null,
      created_by: "human",
    });
    if (error) {
      toast({ title: "Create failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Task created" });
      reset(); onOpenChange(false); onCreated();
    }
    setSaving(false);
  };

  const selectedAssignee = assignees.find(a => a.key === assignedTo);

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>New Task</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="What needs to be done?" />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="Details for the agent…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Assign to</Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger>
                  <div className="flex items-center gap-2">
                    {selectedAssignee && <AssigneeAvatar assignee={selectedAssignee} size="sm" />}
                    <span className="truncate">{selectedAssignee?.name ?? assignedTo}</span>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {assignees.filter(a => a.kind === "agent").length > 0 && (
                    <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">Agents</div>
                  )}
                  {assignees.filter(a => a.kind === "agent").map(a => (
                    <SelectItem key={a.key} value={a.key}><AssigneeOption assignee={a} /></SelectItem>
                  ))}
                  {assignees.filter(a => a.kind === "human").length > 0 && (
                    <div className="px-2 py-1 text-xs font-semibold text-muted-foreground mt-1">People</div>
                  )}
                  {assignees.filter(a => a.kind === "human").map(a => (
                    <SelectItem key={a.key} value={a.key}><AssigneeOption assignee={a} /></SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={v => setPriority(v as Priority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["urgent", "high", "normal", "low"] as Priority[]).map(p => (
                    <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={v => setStatus(v as Status)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COLUMNS.map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Due date</Label>
              <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => { reset(); onOpenChange(false); }}>Cancel</Button>
          <Button onClick={create} disabled={!title.trim() || saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
