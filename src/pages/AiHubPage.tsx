import { useEffect, useState } from "react";
import {
  Sparkles, CheckCircle2, Clock, AlertCircle, Play,
  Activity, Plus, Loader2, Calendar, ChevronDown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

const COLUMNS: { key: Status; label: string; color: string; icon: React.ReactNode }[] = [
  { key: "backlog",     label: "Backlog",     color: "border-slate-400",   icon: <Clock className="h-3.5 w-3.5 text-slate-400" /> },
  { key: "pending",     label: "Pending",     color: "border-blue-400",    icon: <Clock className="h-3.5 w-3.5 text-blue-400" /> },
  { key: "doing",       label: "Doing",       color: "border-yellow-400",  icon: <Play className="h-3.5 w-3.5 text-yellow-400" /> },
  { key: "needs_input", label: "Needs Input", color: "border-purple-400",  icon: <AlertCircle className="h-3.5 w-3.5 text-purple-400" /> },
  { key: "done",        label: "Done",        color: "border-green-400",   icon: <CheckCircle2 className="h-3.5 w-3.5 text-green-400" /> },
  { key: "cancelled",   label: "Cancelled",   color: "border-slate-600",   icon: <AlertCircle className="h-3.5 w-3.5 text-slate-500" /> },
];

const PRIORITY_BADGE: Record<Priority, string> = {
  urgent: "bg-red-100 text-red-800 border-red-200",
  high:   "bg-orange-100 text-orange-800 border-orange-200",
  normal: "bg-blue-100 text-blue-800 border-blue-200",
  low:    "bg-slate-100 text-slate-700 border-slate-200",
};

export default function AiHubPage() {
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<AgentTask | null>(null);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("tasks");

  const fetchTasks = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("agent_tasks")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Failed to load tasks", description: error.message, variant: "destructive" });
    } else {
      setTasks((data ?? []) as AgentTask[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTasks();

    const channel = supabase
      .channel("ai-hub-tasks")
      .on("postgres_changes", { event: "*", schema: "public", table: "agent_tasks" }, fetchTasks)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const tasksByStatus = (status: Status) => tasks.filter(t => t.status === status);

  const stats = {
    pending: tasksByStatus("pending").length + tasksByStatus("backlog").length,
    doing: tasksByStatus("doing").length,
    done: tasksByStatus("done").length,
    needsInput: tasksByStatus("needs_input").length,
  };

  const moveTask = async (taskId: string, newStatus: Status) => {
    const { error } = await supabase.from("agent_tasks").update({ status: newStatus }).eq("id", taskId);
    if (error) toast({ title: "Update failed", description: error.message, variant: "destructive" });
    else fetchTasks();
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
          <Button variant="outline" size="sm" onClick={fetchTasks}>
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
          { label: "Queued", value: stats.pending, color: "bg-blue-100", icon: <Clock className="h-5 w-5 text-blue-600" /> },
          { label: "In Progress", value: stats.doing, color: "bg-yellow-100", icon: <Play className="h-5 w-5 text-yellow-600" /> },
          { label: "Needs Input", value: stats.needsInput, color: "bg-purple-100", icon: <AlertCircle className="h-5 w-5 text-purple-600" /> },
          { label: "Done", value: stats.done, color: "bg-green-100", icon: <CheckCircle2 className="h-5 w-5 text-green-600" /> },
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
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading tasks…
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
                      <span className="ml-auto rounded-full bg-secondary px-2 py-0.5 text-[11px] font-mono">{colTasks.length}</span>
                    </div>
                    <div className="flex flex-col gap-2 max-h-[65vh] overflow-y-auto pr-0.5">
                      {colTasks.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-border/50 p-4 text-center text-xs text-muted-foreground">
                          No tasks
                        </div>
                      ) : colTasks.map(task => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          onClick={() => setSelectedTask(task)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <Card>
            <CardContent className="pt-6 space-y-3">
              {tasks.filter(t => t.status === "done" || t.status === "doing").slice(0, 20).map(task => (
                <div key={task.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="mt-0.5">
                    {task.status === "done"
                      ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                      : <Loader2 className="h-4 w-4 text-yellow-500 animate-spin" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{task.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">{task.assigned_to}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {task.completed_at
                          ? `Completed ${format(parseISO(task.completed_at), "MMM d, h:mm a")}`
                          : task.started_at
                            ? `Started ${format(parseISO(task.started_at), "MMM d, h:mm a")}`
                            : format(parseISO(task.created_at), "MMM d, h:mm a")}
                      </span>
                    </div>
                    {task.result && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{task.result}</p>
                    )}
                  </div>
                </div>
              ))}
              {tasks.filter(t => t.status === "done" || t.status === "doing").length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-8">No activity yet.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Task detail sheet */}
      {selectedTask && (
        <TaskDetailDialog
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onMove={moveTask}
          onRefresh={fetchTasks}
        />
      )}

      {/* New task dialog */}
      <NewTaskDialog
        open={newTaskOpen}
        onOpenChange={setNewTaskOpen}
        onCreated={fetchTasks}
      />
    </div>
  );
}

const TaskCard = ({ task, onClick }: { task: AgentTask; onClick: () => void }) => (
  <div
    onClick={onClick}
    className="cursor-pointer rounded-lg border border-border/60 bg-card p-3 hover:border-primary/40 transition-colors space-y-2"
  >
    <p className="text-sm font-medium leading-snug line-clamp-2">{task.title}</p>
    <div className="flex items-center justify-between gap-1 flex-wrap">
      <span className={`rounded-full border px-2 py-0.5 text-[10px] capitalize ${PRIORITY_BADGE[task.priority]}`}>
        {task.priority}
      </span>
      <span className="text-[10px] text-muted-foreground">{task.assigned_to}</span>
    </div>
    {task.due_date && (
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <Calendar className="h-3 w-3" />
        {format(parseISO(task.due_date), "MMM d")}
      </div>
    )}
  </div>
);

const TaskDetailDialog = ({
  task, onClose, onMove, onRefresh,
}: {
  task: AgentTask;
  onClose: () => void;
  onMove: (id: string, status: Status) => void;
  onRefresh: () => void;
}) => {
  const [status, setStatus] = useState<Status>(task.status);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("agent_tasks").update({ status }).eq("id", task.id);
    if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
    else { toast({ title: "Saved" }); onRefresh(); onClose(); }
    setSaving(false);
  };

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="pr-8 leading-snug">{task.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={`capitalize ${PRIORITY_BADGE[task.priority]}`}>{task.priority}</Badge>
            <Badge variant="outline">{task.assigned_to}</Badge>
          </div>

          {task.description && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Description</p>
              <p className="text-sm whitespace-pre-wrap">{task.description}</p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={v => setStatus(v as Status)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {COLUMNS.map(c => (
                  <SelectItem key={c.key} value={c.key} className="capitalize">{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {task.result && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Result</p>
              <div className="rounded-lg bg-muted/50 p-3 text-sm whitespace-pre-wrap max-h-48 overflow-y-auto">
                {task.result}
              </div>
            </div>
          )}

          {task.error && (
            <div>
              <p className="text-xs font-medium text-red-500 mb-1">Error</p>
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                {task.error}
              </div>
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
  open, onOpenChange, onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) => {
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
      priority,
      status,
      due_date: dueDate || null,
      created_by: "human",
    });
    if (error) {
      toast({ title: "Create failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Task created" });
      reset();
      onOpenChange(false);
      onCreated();
    }
    setSaving(false);
  };

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
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="claude">Claude</SelectItem>
                  <SelectItem value="albus">Albus</SelectItem>
                  <SelectItem value="haiku">Haiku</SelectItem>
                  <SelectItem value="human">Human</SelectItem>
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
                  {COLUMNS.map(c => (
                    <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                  ))}
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
