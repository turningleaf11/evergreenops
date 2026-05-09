import { useEffect, useState } from "react";
import {
  Sparkles, CheckCircle2, Clock, AlertCircle, Play,
  Activity, Plus, Loader2, Calendar, X, MessageCircle, Users, Send,
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import type { AiLog, AiLogCategory } from "@/types/aiLogs";
import { subscribeToAiLogs } from "@/lib/aiLogService";

type Status = "backlog" | "pending" | "doing" | "review" | "approved" | "needs_input" | "done" | "cancelled";
type TaskType = "general" | "research" | "code" | "decision" | "communication";
type Priority = "low" | "normal" | "high" | "urgent";

interface AgentTask {
  id: string;
  title: string;
  description: string;
  assigned_to: string;
  status: Status;
  priority: Priority;
  context: Record<string, unknown> | null;
  type: TaskType;
  result: string | null;
  error: string | null;
  created_by: string | null;
  due_date: string | null;
  deferred_until: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  repo: string | null;
  followers: string[] | null;
  started_at: string | null;
  completed_at: string | null;
}

type CouncilStatus = "running" | "done" | "failed" | "cancelled";

interface CouncilParticipant {
  id: string | null;
  key: string;
  name: string;
  emoji: string | null;
  subtitle: string | null;
  accent_color: string | null;
  position: number;
}

interface CouncilSession {
  id: string;
  question: string;
  status: CouncilStatus;
  participants: CouncilParticipant[] | null;
  workspace_id: string | null;
  created_at: string;
}

interface CouncilMessage {
  id: string;
  session_id: string;
  agent_id: string | null;
  agent_name: string;
  agent_emoji: string | null;
  body: string;
  position: number;
  created_at: string;
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

interface Repo {
  slug: string;
  name: string;
  github_repo: string;
}

type Assignee = {
  key: string;           // slug for agents, user_id for humans
  agent_id: string | null;
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
  { key: "review",      label: "Review",      color: "border-orange-400", icon: <Sparkles className="h-3.5 w-3.5 text-orange-400" /> },
  { key: "approved",    label: "Approved",    color: "border-teal-400",   icon: <CheckCircle2 className="h-3.5 w-3.5 text-teal-400" /> },
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

const CATEGORY_BADGE: Record<AiLogCategory, { label: string; className: string }> = {
  task_started:    { label: "Started",   className: "bg-blue-100 text-blue-800 border-blue-200" },
  task_completed:  { label: "Completed", className: "bg-green-100 text-green-800 border-green-200" },
  task_failed:     { label: "Failed",    className: "bg-red-100 text-red-800 border-red-200" },
  agent_message:   { label: "Message",   className: "bg-slate-100 text-slate-700 border-slate-200" },
};

const ACTIVE_AGENT_STATUSES = new Set(["active", "online"]);

const isToday = (value: string | null) => {
  if (!value) return false;
  const date = new Date(value);
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
};

const formatCompletionTime = (minutes: number | null) => {
  if (minutes === null) return "—";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins === 0 ? `${hours}h` : `${hours}h ${mins}m`;
};

export default function AiHubPage() {
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<AgentTask | null>(null);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [newCouncilOpen, setNewCouncilOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("tasks");
  const [activityLogs, setActivityLogs] = useState<AiLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [councilSessions, setCouncilSessions] = useState<CouncilSession[]>([]);
  const [councilMessages, setCouncilMessages] = useState<CouncilMessage[]>([]);
  const [selectedCouncilId, setSelectedCouncilId] = useState<string | null>(null);

  const fetchAll = async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    const [tasksRes, agentsRes, profilesRes, reposRes, councilSessionsRes, councilMessagesRes] = await Promise.all([
      supabase.from("agent_tasks").select("*").order("created_at", { ascending: false }),
      supabase.from("agents").select("id,name,slug,emoji,avatar_url,subtitle,role,status,accent_color").order("position"),
      supabase.from("profiles").select("user_id,full_name,avatar_url"),
      supabase.from("repos").select("slug,name,github_repo").eq("active", true),
      supabase.from("council_sessions").select("*").order("created_at", { ascending: false }),
      supabase.from("council_messages").select("*").order("position", { ascending: true }).order("created_at", { ascending: true }),
    ]);

    if (tasksRes.error) toast({ title: "Failed to load tasks", description: tasksRes.error.message, variant: "destructive" });
    else setTasks((tasksRes.data ?? []) as AgentTask[]);

    if (councilSessionsRes.error) {
      toast({ title: "Failed to load council sessions", description: councilSessionsRes.error.message, variant: "destructive" });
    } else {
      const sessions = (councilSessionsRes.data ?? []) as CouncilSession[];
      setCouncilSessions(sessions);
      setSelectedCouncilId(current => current ?? sessions[0]?.id ?? null);
    }

    if (councilMessagesRes.error) toast({ title: "Failed to load council messages", description: councilMessagesRes.error.message, variant: "destructive" });
    else setCouncilMessages((councilMessagesRes.data ?? []) as CouncilMessage[]);

    const agentList: Assignee[] = (agentsRes.data ?? []).map((a: Agent) => ({
      key: a.slug, agent_id: a.id, name: a.name, subtitle: a.subtitle ?? a.role, emoji: a.emoji,
      avatar_url: a.avatar_url, status: a.status, kind: "agent", accent_color: a.accent_color,
    }));
    const humanList: Assignee[] = (profilesRes.data ?? []).map((p: HumanProfile) => ({
      key: p.user_id, agent_id: null, name: p.full_name ?? "Human", subtitle: "Team member", emoji: null,
      avatar_url: p.avatar_url, status: "online", kind: "human", accent_color: null,
    }));
    setAssignees([...agentList, ...humanList]);
    setRepos((reposRes.data ?? []) as Repo[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchAll(true);
    const channel = supabase
      .channel("ai-hub-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "agent_tasks" }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "agents" }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "council_sessions" }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "council_messages" }, fetchAll)
      .subscribe((status) => console.log("[AI Hub realtime]", status));
    const poll = setInterval(fetchAll, 5000);
    return () => { supabase.removeChannel(channel); clearInterval(poll); };
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToAiLogs((logs) => {
      setActivityLogs(logs);
      setLogsLoading(false);
    });
    return unsubscribe;
  }, []);

  const findAssignee = (key: string) => assignees.find(a => a.key === key);
  const tasksByStatus = (status: Status) => tasks.filter(t => t.status === status);

  const completionDurations = tasks
    .filter(t => t.started_at && t.completed_at)
    .map(t => Math.round((new Date(t.completed_at!).getTime() - new Date(t.started_at!).getTime()) / 60000))
    .filter(minutes => minutes >= 0);

  const avgCompletionMinutes = completionDurations.length
    ? Math.round(completionDurations.reduce((sum, minutes) => sum + minutes, 0) / completionDurations.length)
    : null;

  const stats = {
    activeAgents: assignees.filter(a => a.kind === "agent" && ACTIVE_AGENT_STATUSES.has(a.status)).length,
    completedToday: tasks.filter(t => t.status === "done" && isToday(t.completed_at)).length,
    needsInput: tasksByStatus("needs_input").length,
    avgCompletionTime: formatCompletionTime(avgCompletionMinutes),
  };

  const latestActivityLogs = activityLogs.slice(0, 3);

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
          { label: "Active Agents",    value: stats.activeAgents,      color: "bg-teal-100",   icon: <Activity className="h-5 w-5 text-teal-600" /> },
          { label: "Completed Today",  value: stats.completedToday,    color: "bg-green-100",  icon: <CheckCircle2 className="h-5 w-5 text-green-600" /> },
          { label: "Needs Input",      value: stats.needsInput,        color: "bg-purple-100", icon: <AlertCircle className="h-5 w-5 text-purple-600" /> },
          { label: "Avg Completion",   value: stats.avgCompletionTime, color: "bg-blue-100",   icon: <Clock className="h-5 w-5 text-blue-600" /> },
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

      <Card className="mb-6">
        <CardContent className="py-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Live Activity</p>
          </div>
          {logsLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading activity…
            </div>
          ) : latestActivityLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No AI activity yet.</p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              {latestActivityLogs.map(log => {
                const badge = CATEGORY_BADGE[log.category];
                return (
                  <div key={log.id} className="flex items-start gap-3 rounded-lg bg-muted/50 px-3 py-2.5 min-w-0">
                    <span
                      className="flex items-center justify-center rounded-full font-semibold text-white h-7 w-7 text-xs shrink-0"
                      style={{ background: colorFor(log.agent_name) }}
                    >
                      {log.agent_emoji ?? initials(log.agent_name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <p className="text-sm font-medium truncate">{log.agent_name}</p>
                        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] ${badge.className}`}>
                          {badge.label}
                        </span>
                      </div>
                      <p className="text-xs text-foreground/80 truncate mt-1">{log.message}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {formatDistanceToNow(parseISO(log.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="council">Council</TabsTrigger>
          <TabsTrigger value="agents">Agents</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading…
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
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
                        <TaskCard
                          key={task.id}
                          task={task}
                          assignee={findAssignee(task.assigned_to)}
                          followers={(task.followers ?? []).map(f => assignees.find(a => a.key === f)).filter(Boolean) as Assignee[]}
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

        <TabsContent value="council" className="mt-4">
          <CouncilTab
            sessions={councilSessions}
            messages={councilMessages}
            agents={assignees.filter(a => a.kind === "agent")}
            selectedSessionId={selectedCouncilId}
            onSelectSession={setSelectedCouncilId}
            onCreateCouncil={() => setNewCouncilOpen(true)}
          />
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
            <CardContent className="pt-6 space-y-3 max-h-[70vh] overflow-y-auto">
              {logsLoading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" /> Loading activity…
                </div>
              ) : activityLogs.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">
                  No activity yet. Run an agent to see logs here.
                </p>
              ) : (
                activityLogs.slice(0, 50).map(log => {
                  const badge = CATEGORY_BADGE[log.category];
                  const accent = log.agent_id
                    ? assignees.find(a => a.kind === "agent" && a.name === log.agent_name)?.accent_color
                    : null;
                  return (
                    <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                      <span
                        className="flex items-center justify-center rounded-full font-semibold text-white h-8 w-8 text-sm shrink-0"
                        style={{ background: accent ?? colorFor(log.agent_name) }}
                      >
                        {log.agent_emoji ?? initials(log.agent_name)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold">{log.agent_name}</p>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] ${badge.className}`}>
                            {badge.label}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(parseISO(log.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        <p className="text-sm text-foreground/80 mt-1 whitespace-pre-wrap break-words">
                          {log.message}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {selectedTask && (
        <TaskDetailDialog
          task={selectedTask}
          assignees={assignees}
          repos={repos}
          onClose={() => setSelectedTask(null)}
          onRefresh={fetchAll}
        />
      )}

      <NewTaskDialog open={newTaskOpen} onOpenChange={setNewTaskOpen} assignees={assignees} repos={repos} onCreated={fetchAll} />
      <NewCouncilDialog
        open={newCouncilOpen}
        onOpenChange={setNewCouncilOpen}
        agents={assignees.filter(a => a.kind === "agent")}
        onCreated={(sessionId) => {
          setSelectedCouncilId(sessionId);
          setActiveTab("council");
          fetchAll();
        }}
      />
    </div>
  );
}

const COUNCIL_STATUS_BADGE: Record<CouncilStatus, string> = {
  running: "bg-blue-100 text-blue-800 border-blue-200",
  done: "bg-green-100 text-green-800 border-green-200",
  failed: "bg-red-100 text-red-800 border-red-200",
  cancelled: "bg-slate-100 text-slate-700 border-slate-200",
};

const orderedParticipants = (session: CouncilSession | null) =>
  [...(session?.participants ?? [])].sort((a, b) => a.position - b.position);

const CouncilTab = ({
  sessions, messages, agents, selectedSessionId, onSelectSession, onCreateCouncil,
}: {
  sessions: CouncilSession[];
  messages: CouncilMessage[];
  agents: Assignee[];
  selectedSessionId: string | null;
  onSelectSession: (id: string) => void;
  onCreateCouncil: () => void;
}) => {
  const selectedSession = sessions.find(s => s.id === selectedSessionId) ?? sessions[0] ?? null;
  const selectedMessages = selectedSession
    ? messages.filter(m => m.session_id === selectedSession.id).sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at))
    : [];
  const participants = orderedParticipants(selectedSession);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-4">
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <p className="text-sm font-semibold">Council Sessions</p>
              <p className="text-xs text-muted-foreground">{sessions.length} thread{sessions.length === 1 ? "" : "s"}</p>
            </div>
            <Button size="sm" onClick={onCreateCouncil}>
              <Plus className="h-4 w-4 mr-2" /> New
            </Button>
          </div>

          {sessions.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/60 p-5 text-center">
              <MessageCircle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm font-medium">No council threads yet</p>
              <p className="text-xs text-muted-foreground mt-1">Ask a question and route it through multiple agents.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[68vh] overflow-y-auto pr-1">
              {sessions.map(session => (
                <button
                  key={session.id}
                  onClick={() => onSelectSession(session.id)}
                  className={`w-full text-left rounded-lg border p-3 transition-colors ${
                    selectedSession?.id === session.id ? "border-primary bg-primary/5" : "border-border/60 hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium line-clamp-2">{session.question}</p>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] capitalize ${COUNCIL_STATUS_BADGE[session.status]}`}>
                      {session.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    <span>{(session.participants ?? []).length} agents</span>
                    <span className="ml-auto">{formatDistanceToNow(parseISO(session.created_at), { addSuffix: true })}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5">
          {!selectedSession ? (
            <div className="min-h-[420px] flex items-center justify-center text-center">
              <div>
                <MessageCircle className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm font-medium">Start a council</p>
                <p className="text-xs text-muted-foreground mt-1">Select agents, ask one question, and watch the thread fill in order.</p>
                <Button size="sm" className="mt-4" onClick={onCreateCouncil}>
                  <Plus className="h-4 w-4 mr-2" /> New Council
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <MessageCircle className="h-4 w-4 text-primary" />
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] capitalize ${COUNCIL_STATUS_BADGE[selectedSession.status]}`}>
                      {selectedSession.status}
                    </span>
                  </div>
                  <h2 className="text-lg font-semibold leading-snug">{selectedSession.question}</h2>
                  <p className="text-xs text-muted-foreground mt-2">
                    Created {format(parseISO(selectedSession.created_at), "MMM d, h:mm a")}
                  </p>
                </div>
                <div className="hidden md:flex items-center -space-x-2 shrink-0">
                  {participants.map(participant => {
                    const agent = agents.find(a => a.key === participant.key);
                    return (
                      <div key={participant.key} className="ring-2 ring-background rounded-full">
                        <AssigneeAvatar assignee={agent ?? {
                          key: participant.key,
                          agent_id: participant.id,
                          name: participant.name,
                          subtitle: participant.subtitle,
                          emoji: participant.emoji,
                          avatar_url: null,
                          status: "active",
                          kind: "agent",
                          accent_color: participant.accent_color,
                        }} />
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-4 max-h-[64vh] overflow-y-auto pr-2">
                {participants.map(participant => {
                  const message = selectedMessages.find(m => m.position === participant.position);
                  const agent = agents.find(a => a.key === participant.key);
                  return (
                    <div key={`${selectedSession.id}-${participant.key}`} className="flex items-start gap-3">
                      <div className="relative shrink-0">
                        <AssigneeAvatar assignee={agent ?? {
                          key: participant.key,
                          agent_id: participant.id,
                          name: participant.name,
                          subtitle: participant.subtitle,
                          emoji: participant.emoji,
                          avatar_url: null,
                          status: message ? "active" : "idle",
                          kind: "agent",
                          accent_color: participant.accent_color,
                        }} size="md" />
                        {!message && selectedSession.status === "running" && (
                          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-yellow-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold">{participant.name}</p>
                          {participant.subtitle && <p className="text-xs text-muted-foreground">{participant.subtitle}</p>}
                          {message && (
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(parseISO(message.created_at), { addSuffix: true })}
                            </span>
                          )}
                        </div>
                        {message ? (
                          <div className="mt-2 rounded-lg border border-border bg-muted/30 p-4 text-sm leading-relaxed whitespace-pre-wrap break-words">
                            {cleanResult(message.body)}
                          </div>
                        ) : (
                          <div className="mt-2 rounded-lg border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
                            Waiting for this agent's turn.
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const NewCouncilDialog = ({
  open, onOpenChange, agents, onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  agents: Assignee[];
  onCreated: (sessionId: string) => void;
}) => {
  const [question, setQuestion] = useState("");
  const [selectedAgentKeys, setSelectedAgentKeys] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && selectedAgentKeys.length === 0 && agents.length > 0) {
      setSelectedAgentKeys(agents.slice(0, 3).map(a => a.key));
    }
  }, [open, agents, selectedAgentKeys.length]);

  const reset = () => {
    setQuestion("");
    setSelectedAgentKeys(agents.slice(0, 3).map(a => a.key));
  };

  const toggleAgent = (key: string) => {
    setSelectedAgentKeys(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const create = async () => {
    const selectedAgents = selectedAgentKeys
      .map(key => agents.find(a => a.key === key))
      .filter(Boolean) as Assignee[];

    if (!question.trim() || selectedAgents.length === 0) return;

    const participants: CouncilParticipant[] = selectedAgents.map((agent, index) => ({
      id: agent.agent_id,
      key: agent.key,
      name: agent.name,
      emoji: agent.emoji,
      subtitle: agent.subtitle,
      accent_color: agent.accent_color,
      position: index,
    }));

    setSaving(true);
    const { data: session, error: sessionError } = await supabase
      .from("council_sessions")
      .insert({
        question: question.trim(),
        status: "running",
        participants,
      })
      .select("id")
      .single();

    if (sessionError || !session) {
      toast({ title: "Council failed", description: sessionError?.message ?? "Session was not created.", variant: "destructive" });
      setSaving(false);
      return;
    }

    const taskRows = participants.map(participant => ({
      title: `Council: ${question.trim().slice(0, 90)}`,
      description: `Council question:\n${question.trim()}\n\nRespond as ${participant.name}. Your response will be shown in a shared council thread.`,
      assigned_to: participant.key,
      priority: "normal" as Priority,
      status: participant.position === 0 ? "pending" as Status : "backlog" as Status,
      type: "decision" as TaskType,
      created_by: "human",
      context: {
        council_session_id: session.id,
        council_position: participant.position,
        council_participant_count: participants.length,
        council_question: question.trim(),
      },
    }));

    const { error: tasksError } = await supabase.from("agent_tasks").insert(taskRows);

    if (tasksError) {
      await supabase.from("council_sessions").update({ status: "failed" }).eq("id", session.id);
      toast({ title: "Council tasks failed", description: tasksError.message, variant: "destructive" });
    } else {
      toast({ title: "Council started", description: `${participants.length} agents queued.` });
      reset();
      onOpenChange(false);
      onCreated(session.id);
    }

    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>New Council</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Question</Label>
            <Textarea
              autoFocus
              rows={4}
              value={question}
              onChange={e => setQuestion(e.target.value)}
              placeholder="What should the agents weigh in on?"
            />
          </div>

          <div className="space-y-2">
            <Label>Participants</Label>
            <div className="rounded-lg border border-border divide-y max-h-64 overflow-y-auto">
              {agents.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4">No agents are available.</p>
              ) : agents.map(agent => (
                <button
                  key={agent.key}
                  type="button"
                  onClick={() => toggleAgent(agent.key)}
                  className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/60 transition-colors"
                >
                  <Checkbox checked={selectedAgentKeys.includes(agent.key)} className="pointer-events-none" />
                  <AssigneeAvatar assignee={agent} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{agent.name}</p>
                    {agent.subtitle && <p className="text-xs text-muted-foreground truncate">{agent.subtitle}</p>}
                  </div>
                  {selectedAgentKeys.includes(agent.key) && (
                    <span className="text-xs font-mono text-muted-foreground">
                      #{selectedAgentKeys.indexOf(agent.key) + 1}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Agents respond in the order selected.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => { reset(); onOpenChange(false); }}>Cancel</Button>
          <Button onClick={create} disabled={!question.trim() || selectedAgentKeys.length === 0 || saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Start Council
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const TaskCard = ({ task, assignee, followers, onClick }: { task: AgentTask; assignee: Assignee | undefined; followers: Assignee[]; onClick: () => void }) => (
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
      <div className="flex flex-col items-end gap-1">
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] capitalize ${PRIORITY_BADGE[task.priority]}`}>
          {task.priority}
        </span>
        <span className="shrink-0 rounded-full border border-border/60 bg-secondary px-2 py-0.5 text-[10px] capitalize text-muted-foreground">
          {task.type}
        </span>
        {task.repo && (
          <span className="shrink-0 rounded-full border border-teal-200 bg-teal-50 px-2 py-0.5 text-[10px] text-teal-700 font-mono">
            {task.repo}
          </span>
        )}
      </div>
    </div>
    {(task.due_date || followers.length > 0) && (
      <div className="flex items-center justify-between">
        {task.due_date ? (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {format(parseISO(task.due_date), "MMM d")}
          </div>
        ) : <span />}
        {followers.length > 0 && (
          <div className="flex items-center -space-x-1.5">
            {followers.slice(0, 3).map(f => (
              <div key={f.key} className="ring-1 ring-background rounded-full">
                <AssigneeAvatar assignee={f} size="sm" />
              </div>
            ))}
            {followers.length > 3 && (
              <span className="ring-1 ring-background rounded-full flex items-center justify-center h-6 w-6 bg-secondary text-[9px] font-semibold text-muted-foreground">
                +{followers.length - 3}
              </span>
            )}
          </div>
        )}
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

// Strip raw tool call XML from PM2 worker results
const cleanResult = (raw: string) =>
  raw.replace(/<tool_call>[\s\S]*?<\/tool_call>/g, "")
     .replace(/<tool_response>[\s\S]*?<\/tool_response>/g, "")
     .replace(/^\s*\n/gm, "")
     .trim();

const TaskDetailDialog = ({
  task, assignees, repos, onClose, onRefresh,
}: { task: AgentTask; assignees: Assignee[]; repos: Repo[]; onClose: () => void; onRefresh: () => void }) => {
  const [status, setStatus] = useState<Status>(task.status);
  const [assignedTo, setAssignedTo] = useState(task.assigned_to);
  const [repo, setRepo] = useState(task.repo ?? "none");
  const [type, setType] = useState<TaskType>(task.type ?? "general");
  const [followers, setFollowers] = useState<string[]>(task.followers ?? []);
  const [saving, setSaving] = useState(false);

  const addFollower = (key: string) => {
    if (!followers.includes(key)) setFollowers(prev => [...prev, key]);
  };
  const removeFollower = (key: string) => setFollowers(prev => prev.filter(f => f !== key));

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("agent_tasks")
      .update({ status, assigned_to: assignedTo, repo: (repo && repo !== "none") ? repo : null, type, followers })
      .eq("id", task.id);
    if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
    else { toast({ title: "Saved" }); onRefresh(); onClose(); }
    setSaving(false);
  };

  const assignee = assignees.find(a => a.key === assignedTo);
  const col = COLUMNS.find(c => c.key === status);

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto p-0">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border">
          <div className="flex items-start gap-3 pr-8">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">{task.type}</p>
              <h2 className="text-lg font-semibold leading-snug">{task.title}</h2>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${PRIORITY_BADGE[task.priority]}`}>
              {task.priority}
            </span>
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium bg-secondary`}>
              {col?.icon}<span className="capitalize">{status.replace("_", " ")}</span>
            </span>
            {task.repo && (
              <span className="inline-flex items-center rounded-full border border-teal-200 bg-teal-50 px-2.5 py-0.5 text-xs font-mono text-teal-700">
                {task.repo}
              </span>
            )}
          </div>
        </div>

        <div className="px-6 py-4 space-y-5">
          {/* Description */}
          {task.description && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Description</p>
              <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">{task.description}</p>
            </div>
          )}

          {/* Controls */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Type</Label>
              <Select value={type} onValueChange={v => setType(v as TaskType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["general", "research", "code", "decision", "communication"] as TaskType[]).map(t => (
                    <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Assigned to</Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger>
                  <div className="flex items-center gap-2">
                    {assignee && <AssigneeAvatar assignee={assignee} size="sm" />}
                    <span className="truncate">{assignee?.name ?? assignedTo}</span>
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
              <Label className="text-xs">Status</Label>
              <Select value={status} onValueChange={v => setStatus(v as Status)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COLUMNS.map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Repo</Label>
            <Select value={repo} onValueChange={setRepo}>
              <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {repos.map(r => (
                  <SelectItem key={r.slug} value={r.slug}>
                    <span className="font-mono text-sm">{r.github_repo}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Followers */}
          <div className="space-y-1.5">
            <Label className="text-xs">Followers</Label>
            <div className="flex flex-wrap gap-1.5 mb-1.5">
              {followers.map(key => {
                const f = assignees.find(a => a.key === key);
                if (!f) return null;
                return (
                  <span key={key} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary pl-1 pr-2 py-0.5 text-xs">
                    <AssigneeAvatar assignee={f} size="sm" />
                    <span className="font-medium">{f.name}</span>
                    <button onClick={() => removeFollower(key)} className="ml-0.5 text-muted-foreground hover:text-foreground transition-colors">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                );
              })}
            </div>
            <Select value="none" onValueChange={v => v !== "none" && addFollower(v)}>
              <SelectTrigger>
                <span className="text-muted-foreground text-sm">Add follower…</span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none" className="text-muted-foreground">Add follower…</SelectItem>
                {assignees.filter(a => a.key !== assignedTo && !followers.includes(a.key)).length > 0 && (
                  <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">Agents</div>
                )}
                {assignees.filter(a => a.kind === "agent" && a.key !== assignedTo && !followers.includes(a.key)).map(a => (
                  <SelectItem key={a.key} value={a.key}><AssigneeOption assignee={a} /></SelectItem>
                ))}
                {assignees.filter(a => a.kind === "human" && a.key !== assignedTo && !followers.includes(a.key)).length > 0 && (
                  <div className="px-2 py-1 text-xs font-semibold text-muted-foreground mt-1">People</div>
                )}
                {assignees.filter(a => a.kind === "human" && a.key !== assignedTo && !followers.includes(a.key)).map(a => (
                  <SelectItem key={a.key} value={a.key}><AssigneeOption assignee={a} /></SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          {task.notes && (
            <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Notes from Albus</p>
              <p className="text-sm leading-relaxed">{task.notes}</p>
            </div>
          )}

          {/* Result */}
          {task.result && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Result</p>
              <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto">
                {cleanResult(task.result)}
              </div>
            </div>
          )}

          {/* Error */}
          {task.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-1">Error</p>
              <p className="text-sm text-red-700">{task.error}</p>
            </div>
          )}

          {/* Timestamps */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground pt-1 border-t border-border">
            <div>Created · {format(parseISO(task.created_at), "MMM d, h:mm a")}</div>
            {task.due_date && <div>Due · {format(parseISO(task.due_date), "MMM d")}</div>}
            {task.started_at && <div>Started · {format(parseISO(task.started_at), "MMM d, h:mm a")}</div>}
            {task.completed_at && <div>Completed · {format(parseISO(task.completed_at), "MMM d, h:mm a")}</div>}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const NewTaskDialog = ({
  open, onOpenChange, assignees, repos, onCreated,
}: { open: boolean; onOpenChange: (v: boolean) => void; assignees: Assignee[]; repos: Repo[]; onCreated: () => void }) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignedTo, setAssignedTo] = useState("claude");
  const [priority, setPriority] = useState<Priority>("normal");
  const [status, setStatus] = useState<Status>("pending");
  const [type, setType] = useState<TaskType>("general");
  const [repo, setRepo] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => { setTitle(""); setDescription(""); setAssignedTo("claude"); setPriority("normal"); setStatus("pending"); setType("general"); setRepo(""); setDueDate(""); };

  const create = async () => {
    if (!title.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("agent_tasks").insert({
      title: title.trim(),
      description: description.trim() || title.trim(),
      assigned_to: assignedTo,
      priority, status, type,
      repo: (repo && repo !== "none") ? repo : null,
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
              <Label>Type</Label>
              <Select value={type} onValueChange={v => setType(v as TaskType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["general", "research", "code", "decision", "communication"] as TaskType[]).map(t => (
                    <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
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
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Repo</Label>
              <Select value={repo} onValueChange={setRepo}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {repos.map(r => (
                    <SelectItem key={r.slug} value={r.slug}>{r.name}</SelectItem>
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
