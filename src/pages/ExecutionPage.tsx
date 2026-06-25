import { useState, useEffect, useCallback, useMemo, Fragment } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDepartments } from "@/contexts/DepartmentsContext";
import ProjectPeek from "@/components/execution/ProjectPeek";
import TaskPeek from "@/components/mention-peek/peeks/TaskPeek";
import GoalCard from "@/components/execution/GoalCard";
import GoalPeek from "@/components/execution/GoalPeek";
import ViewControls, { ViewMode, SortField, SortDir } from "@/components/execution/ViewControls";
import { useViewPreference } from "@/hooks/useViewPreference";
import KanbanBoard from "@/components/execution/KanbanBoard";
import TableView from "@/components/execution/TableView";
import DataTableView from "@/components/execution/DataTableView";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Target, Plus, ChevronDown, Calendar, CheckCircle2, Circle, Clock,
  AlertTriangle, XCircle, AlertCircle, ArrowRight, MessageSquare, Lightbulb, X, Search,
  User, Repeat, Sparkles,
} from "lucide-react";
import { AgentTaskDetail } from "@/components/execution/AgentTaskDetail";
import { toast } from "sonner";
import TaskTemplateManager from "@/components/TaskTemplateManager";
import { CadencesTab } from "@/components/cadences/CadencesTab";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatusBadge as SharedStatusBadge, TASK_STATUS_VARIANT, PRIORITY_VARIANT, PRIORITY_LABEL } from "@/components/shared/StatusBadge";
import { FolderKanban } from "lucide-react";
import { LeadReviewTab } from "@/components/execution/LeadReviewTab";
import { CouncilPanel } from "@/components/execution/CouncilTab";
import { usePageAccess } from "@/hooks/usePageAccess";

type Goal = {
  id: string; title: string; description: string; quarter: string; year: number;
  status: string; owner_id: string | null; department_id: string | null;
  created_by: string | null; progress: number; created_at: string; updated_at: string;
  measurable_target: string; deadline: string | null; key_results: any[]; alignment_notes: string;
};
type Project = {
  id: string; title: string; description: string; goal_id: string | null;
  status: string; priority: string; owner_id: string | null; department_id: string | null;
  due_date: string | null; created_by: string | null; created_at: string; updated_at: string;
  tags: string[]; assignees: string[];
};
type Task = {
  id: string; title: string; description: string; project_id: string | null;
  goal_id: string | null; status: string; priority: string; assigned_to: string | null;
  due_date: string | null; created_by: string | null; created_at: string; updated_at: string;
  tags: string[]; is_recurring?: boolean; recurrence_rule?: any; recurring_parent_id?: string | null;
};
type AgentTask = {
  id: string; title: string; description: string | null; assigned_to: string;
  status: string; priority: string; created_at: string; updated_at: string;
  due_date: string | null; is_system_task: boolean; context: Record<string, unknown> | null;
};
type AgentMeta = { slug: string; name: string; emoji: string | null; avatar_url: string | null; accent_color: string | null };

const AGENT_STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  backlog: { label: "To do", cls: "bg-muted text-muted-foreground" },
  pending: { label: "To do", cls: "bg-muted text-muted-foreground" },
  doing: { label: "In progress", cls: "bg-blue-100 text-blue-800" },
  review: { label: "Albus reviewing", cls: "bg-purple-100 text-purple-800" },
  approved: { label: "Albus reviewing", cls: "bg-purple-100 text-purple-800" },
  needs_input: { label: "Needs your input", cls: "bg-red-100 text-red-800" },
  done: { label: "Done", cls: "bg-green-100 text-green-800" },
  cancelled: { label: "Cancelled", cls: "bg-muted text-muted-foreground" },
};

type Issue = {
  id: string; title: string; description: string; raised_by: string | null;
  department_id: string | null; priority: number; status: string;
  root_cause: string; discussion_notes: string; resolution: string;
  resolved_action_type: string; resolved_action_id: string | null;
  created_at: string; updated_at: string;
  category: string; assigned_to: string | null; tags: string[];
};

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  on_track: { label: "On Track", color: "bg-green-100 text-green-800", icon: CheckCircle2 },
  behind: { label: "Behind", color: "bg-yellow-100 text-yellow-800", icon: Clock },
  at_risk: { label: "At Risk", color: "bg-red-100 text-red-800", icon: AlertTriangle },
  done: { label: "Done", color: "bg-blue-100 text-blue-800", icon: CheckCircle2 },
  not_done: { label: "Not Done", color: "bg-muted text-muted-foreground", icon: XCircle },
  not_started: { label: "Not Started", color: "bg-muted text-muted-foreground", icon: Circle },
  in_progress: { label: "In Progress", color: "bg-blue-100 text-blue-800", icon: Clock },
  blocked: { label: "Blocked", color: "bg-red-100 text-red-800", icon: AlertTriangle },
  todo: { label: "To Do", color: "bg-muted text-muted-foreground", icon: Circle },
};

const priorityLabels: Record<number, { label: string; color: string }> = {
  1: { label: "High", color: "bg-red-100 text-red-800" },
  2: { label: "Medium", color: "bg-yellow-100 text-yellow-800" },
  3: { label: "Low", color: "bg-green-100 text-green-800" },
};

const projectStatusOptions = [
  { value: "not_started", label: "Not Started" },
  { value: "in_progress", label: "In Progress" },
  { value: "done", label: "Done" },
  { value: "blocked", label: "Blocked" },
];

const taskStatusOptions = [
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "blocked", label: "Blocked" },
  { value: "done", label: "Done" },
];

const priorityOptions = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

const projectKanbanColsBase = [
  { key: "not_started", label: "Not Started", color: "slate" },
  { key: "in_progress", label: "In Progress", color: "blue" },
  { key: "blocked", label: "Blocked", color: "red" },
  { key: "done", label: "Done", color: "green" },
];

const taskKanbanColsBase = [
  { key: "todo", label: "To Do", color: "slate" },
  { key: "in_progress", label: "In Progress", color: "blue" },
  { key: "blocked", label: "Blocked", color: "red" },
  { key: "done", label: "Done", color: "green" },
];

const priorityOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

const currentQuarter = () => { const m = new Date().getMonth(); return `Q${Math.floor(m / 3) + 1}`; };
const currentYear = () => new Date().getFullYear();

function useViewState(viewKey: string) {
  const [search, setSearch] = useState("");
  const [view, setView] = useViewPreference<ViewMode>(`execution:${viewKey}:view`, "list");
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  return { search, setSearch, view, setView, sortField, setSortField, sortDir, setSortDir, filterStatus, setFilterStatus, filterPriority, setFilterPriority };
}

function applyFilters<T extends { title: string; status: string; priority?: string | number }>(
  items: T[], search: string, filterStatus: string, filterPriority: string,
  sortField: SortField, sortDir: SortDir
): T[] {
  let result = items;
  if (search) {
    const q = search.toLowerCase();
    result = result.filter(i => i.title.toLowerCase().includes(q));
  }
  if (filterStatus !== "all") result = result.filter(i => i.status === filterStatus);
  if (filterPriority !== "all") result = result.filter(i => String(i.priority) === filterPriority);

  result = [...result].sort((a, b) => {
    let av: any, bv: any;
    switch (sortField) {
      case "title": av = a.title.toLowerCase(); bv = b.title.toLowerCase(); break;
      case "priority": av = priorityOrder[(a as any).priority] ?? 99; bv = priorityOrder[(b as any).priority] ?? 99; break;
      case "status": av = a.status; bv = b.status; break;
      case "due_date": av = (a as any).due_date || "9999"; bv = (b as any).due_date || "9999"; break;
      default: av = (a as any).created_at; bv = (b as any).created_at; break;
    }
    if (av < bv) return sortDir === "asc" ? -1 : 1;
    if (av > bv) return sortDir === "asc" ? 1 : -1;
    return 0;
  });
  return result;
}

export default function ExecutionPage() {
  const { user, isAdmin } = useAuth();
  const { allowed: councilAllowed } = usePageAccess("ai_hub", "primary_admin");
  const { departments } = useDepartments();
  const navigate = useNavigate();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [agentTasks, setAgentTasks] = useState<AgentTask[]>([]);
  const [agentsMeta, setAgentsMeta] = useState<AgentMeta[]>([]);
  const [repos, setRepos] = useState<{ slug: string; name: string; github_repo: string }[]>([]);
  const [taskSourceFilter, setTaskSourceFilter] = useState<"all" | "mine" | "ai" | "needs_input">("all");
  const [taskGroupBy, setTaskGroupBy] = useState<"none" | "status" | "priority" | "due_date" | "assignee">("none");
  const [showSystemTasks, setShowSystemTasks] = useState(false);
  const [agentTaskPeekId, setAgentTaskPeekId] = useState<string | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [profiles, setProfiles] = useState<{ user_id: string; full_name: string | null; avatar_url?: string | null }[]>([]);
  const [stageColors, setStageColors] = useState<Record<string, string>>({});
  const [tab, setTab] = useState(() => {
    if (typeof window === "undefined") return "goals";
    const params = new URLSearchParams(window.location.search);
    return params.get("tab") || "goals";
  });
  const [createGoalOpen, setCreateGoalOpen] = useState(false);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [projectPeekId, setProjectPeekId] = useState<string | null>(null);
  const [taskPeekId, setTaskPeekId] = useState<string | null>(null);
  const [peekGoalId, setPeekGoalId] = useState<string | null>(null);
  // Goals filters persist across sessions in localStorage
  const [goalQuarter, setGoalQuarter] = useState<string>(() => localStorage.getItem("execution.goals.quarter") || "all");
  const [goalYear, setGoalYear] = useState<string>(() => localStorage.getItem("execution.goals.year") || "all");
  const [goalDept, setGoalDept] = useState<string>(() => localStorage.getItem("execution.goals.dept") || "all");
  const [goalGroupBy, setGoalGroupBy] = useState<"quarter" | "department" | "none">(
    () => (localStorage.getItem("execution.goals.groupBy") as "quarter" | "department" | "none") || "quarter",
  );
  useEffect(() => { localStorage.setItem("execution.goals.quarter", goalQuarter); }, [goalQuarter]);
  useEffect(() => { localStorage.setItem("execution.goals.year", goalYear); }, [goalYear]);
  useEffect(() => { localStorage.setItem("execution.goals.dept", goalDept); }, [goalDept]);
  useEffect(() => { localStorage.setItem("execution.goals.groupBy", goalGroupBy); }, [goalGroupBy]);

  const projectKanbanCols = useMemo(
    () => projectKanbanColsBase.map(c => ({ ...c, color: stageColors[`project:${c.key}`] || c.color })),
    [stageColors]
  );
  const taskKanbanCols = useMemo(
    () => taskKanbanColsBase.map(c => ({ ...c, color: stageColors[`task:${c.key}`] || c.color })),
    [stageColors]
  );

  // Issues state
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [createIssueOpen, setCreateIssueOpen] = useState(false);
  const [newIssueTitle, setNewIssueTitle] = useState("");
  const [newIssueDesc, setNewIssueDesc] = useState("");
  const [newIssuePriority, setNewIssuePriority] = useState("2");
  const [newIssueDept, setNewIssueDept] = useState("");
  const [newIssueCategory, setNewIssueCategory] = useState("general");
  const [newIssueAssignee, setNewIssueAssignee] = useState("");
  const [issueViewTab, setIssueViewTab] = useState("open");
  const [issueCategoryFilter, setIssueCategoryFilter] = useState("all");

  // View states for projects and tasks tabs
  const pv = useViewState("projects");
  const tv = useViewState("tasks");

  const fetchAll = useCallback(async () => {
    const [g, p, t, pr, i, at, ag, rp] = await Promise.all([
      supabase.from("goals").select("*").order("year", { ascending: false }).order("quarter"),
      supabase.from("projects").select("*").order("created_at", { ascending: false }),
      supabase.from("tasks").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("user_id, full_name, avatar_url"),
      supabase.from("issues").select("*").order("priority").order("created_at", { ascending: false }),
      supabase.from("agent_tasks").select("*").order("created_at", { ascending: false }),
      supabase.from("agents").select("slug, name, emoji, avatar_url, accent_color"),
      supabase.from("repos").select("slug, name, github_repo").eq("active", true),
    ]);
    if (g.data) setGoals(g.data as any);
    if (p.data) setProjects(p.data as any);
    if (t.data) setTasks(t.data as any);
    if (pr.data) setProfiles(pr.data);
    if (i.data) setIssues(i.data as any);
    if (at.data) setAgentTasks(at.data as any);
    if (ag.data) setAgentsMeta(ag.data as any);
    if (rp.data) setRepos(rp.data as any);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const getName = (uid: string | null) => {
    if (!uid) return "Unassigned";
    return profiles.find(p => p.user_id === uid)?.full_name || "Unknown";
  };

  // Filtered/sorted items
  const filteredProjects = useMemo(() =>
    applyFilters(projects, pv.search, pv.filterStatus, pv.filterPriority, pv.sortField, pv.sortDir),
    [projects, pv.search, pv.filterStatus, pv.filterPriority, pv.sortField, pv.sortDir]
  );

  const visibleTasks = useMemo(() => {
    const base = isAdmin ? tasks : tasks.filter(t => t.assigned_to === user?.id);
    return applyFilters(base, tv.search, tv.filterStatus, tv.filterPriority, tv.sortField, tv.sortDir);
  }, [tasks, isAdmin, user?.id, tv.search, tv.filterStatus, tv.filterPriority, tv.sortField, tv.sortDir]);

  const visibleAgentTasks = useMemo(
    () => agentTasks.filter(t => showSystemTasks || !t.is_system_task),
    [agentTasks, showSystemTasks]
  );
  const systemHiddenCount = useMemo(
    () => agentTasks.filter(t => t.is_system_task).length,
    [agentTasks]
  );
  const needsInputCount = useMemo(
    () => agentTasks.filter(t => t.status === "needs_input").length,
    [agentTasks]
  );
  const getAgentMeta = (slug: string) => agentsMeta.find(a => a.slug === slug);

  // Unified Tasks tab feed (list view only): human tasks + agent tasks merged
  // into one chronological feed, per the AI Hub / Execution Hub task-board merge.
  type UnifiedRow = { kind: "human"; task: Task } | { kind: "agent"; task: AgentTask };
  const unifiedFeed = useMemo<UnifiedRow[]>(() => {
    let humanRows: UnifiedRow[] = [];
    let agentRows: UnifiedRow[] = [];
    if (taskSourceFilter === "all") {
      humanRows = visibleTasks.map(task => ({ kind: "human" as const, task }));
      agentRows = visibleAgentTasks.map(task => ({ kind: "agent" as const, task }));
    } else if (taskSourceFilter === "mine") {
      humanRows = applyFilters(
        tasks.filter(t => t.assigned_to === user?.id),
        tv.search, tv.filterStatus, tv.filterPriority, tv.sortField, tv.sortDir
      ).map(task => ({ kind: "human" as const, task }));
    } else if (taskSourceFilter === "ai") {
      agentRows = visibleAgentTasks.map(task => ({ kind: "agent" as const, task }));
    } else if (taskSourceFilter === "needs_input") {
      agentRows = visibleAgentTasks.filter(t => t.status === "needs_input").map(task => ({ kind: "agent" as const, task }));
    }
    return [...humanRows, ...agentRows].sort(
      (a, b) => new Date(b.task.created_at).getTime() - new Date(a.task.created_at).getTime()
    );
  }, [taskSourceFilter, visibleTasks, visibleAgentTasks, tasks, user?.id, tv.search, tv.filterStatus, tv.filterPriority, tv.sortField, tv.sortDir]);

  // Shared bucketing across human tasks + agent_tasks — used by both the
  // board view's columns and the list/table "Group by" control, so the two
  // task models line up the same way everywhere.
  const statusBucket = (row: UnifiedRow): string => {
    if (row.kind === "human") return row.task.status;
    if (["backlog", "pending"].includes(row.task.status)) return "todo";
    if (row.task.status === "needs_input") return "blocked";
    if (row.task.status === "done" || row.task.status === "cancelled") return "done";
    return "in_progress"; // doing, review, approved
  };
  const priorityKey = (row: UnifiedRow): string => {
    const p = row.task.priority || "medium";
    return p === "normal" ? "medium" : p;
  };
  const assigneeLabel = (row: UnifiedRow): string =>
    row.kind === "human" ? getName(row.task.assigned_to) : (getAgentMeta(row.task.assigned_to)?.name || row.task.assigned_to);
  const dueDateBucket = (row: UnifiedRow): { key: string; label: string; order: number } => {
    const dueRaw = row.task.due_date;
    if (!dueRaw) return { key: "none", label: "No Due Date", order: 99 };
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const due = new Date(dueRaw.length <= 10 ? `${dueRaw}T00:00:00` : dueRaw);
    const diff = Math.floor((due.getTime() - today.getTime()) / 86400000);
    if (diff < 0) return { key: "overdue", label: "Overdue", order: 0 };
    if (diff === 0) return { key: "today", label: "Today", order: 1 };
    if (diff === 1) return { key: "tomorrow", label: "Tomorrow", order: 2 };
    if (diff <= 7) return { key: "week", label: "This Week", order: 3 };
    if (diff <= 30) return { key: "month", label: "This Month", order: 4 };
    return { key: "later", label: "Later", order: 5 };
  };

  const groupedUnifiedFeed = useMemo(() => {
    if (taskGroupBy === "none") return [{ key: "all", label: "", rows: unifiedFeed }];
    const groups = new Map<string, { label: string; order: number; rows: UnifiedRow[] }>();
    for (const row of unifiedFeed) {
      let key: string, label: string, order: number;
      if (taskGroupBy === "status") {
        key = statusBucket(row);
        const col = taskKanbanCols.find(c => c.key === key);
        label = col?.label || key;
        order = taskKanbanCols.findIndex(c => c.key === key);
      } else if (taskGroupBy === "priority") {
        key = priorityKey(row);
        const opt = priorityOptions.find(p => p.value === key);
        label = opt?.label || "No Priority";
        order = priorityOrder[key] ?? 99;
      } else if (taskGroupBy === "due_date") {
        const d = dueDateBucket(row);
        key = d.key; label = d.label; order = d.order;
      } else {
        label = assigneeLabel(row);
        key = label;
        order = 0;
      }
      if (!groups.has(key)) groups.set(key, { label, order, rows: [] });
      groups.get(key)!.rows.push(row);
    }
    const sorted = Array.from(groups.entries()).sort((a, b) =>
      taskGroupBy === "assignee" ? a[1].label.localeCompare(b[1].label) : a[1].order - b[1].order
    );
    return sorted.map(([key, g]) => ({ key, label: g.label, rows: g.rows }));
  }, [unifiedFeed, taskGroupBy, taskKanbanCols]);

  const goalsByQuarter = goals.reduce<Record<string, Goal[]>>((acc, g) => {
    const key = `${g.year} ${g.quarter}`;
    (acc[key] = acc[key] || []).push(g);
    return acc;
  }, {});

  const projectsForGoal = (goalId: string) => projects.filter(p => p.goal_id === goalId);
  const tasksForProject = (projectId: string) => tasks.filter(t => t.project_id === projectId);
  const tasksForGoal = (goalId: string) => tasks.filter(t => t.goal_id === goalId && !t.project_id);

  const createGoal = async (data: {
    title: string; quarter: string; year: number; description: string; department_id: string;
    measurable_target?: string; deadline?: string; key_results?: any[]; alignment_notes?: string;
  }) => {
    const { error } = await supabase.from("goals").insert({
      title: data.title, quarter: data.quarter, year: data.year,
      description: data.description, department_id: data.department_id || null,
      owner_id: user?.id, created_by: user?.id,
      measurable_target: data.measurable_target || "",
      deadline: data.deadline || null,
      key_results: data.key_results || [],
      alignment_notes: data.alignment_notes || "",
    });
    if (error) toast.error(error.message);
    else { toast.success("Goal created"); setCreateGoalOpen(false); fetchAll(); }
  };

  const createProject = async (data: { title: string; goal_id: string; description: string; department_id: string }) => {
    const { error } = await supabase.from("projects").insert({
      title: data.title, goal_id: data.goal_id || null,
      description: data.description, department_id: data.department_id || null,
      owner_id: user?.id, created_by: user?.id,
    });
    if (error) toast.error(error.message);
    else { toast.success("Project created"); setCreateProjectOpen(false); fetchAll(); }
  };

  const createTask = async (data: {
    title: string; project_id: string; goal_id: string; description: string; assigned_to: string;
    agent_type?: string; agent_repo?: string;
  }) => {
    const isAgent = agentsMeta.some(a => a.slug === data.assigned_to);
    if (isAgent) {
      const { error } = await supabase.from("agent_tasks").insert({
        title: data.title,
        description: data.description || data.title,
        assigned_to: data.assigned_to,
        type: data.agent_type || "general",
        repo: data.agent_repo || null,
        // project_id intentionally omitted until the agent_tasks.project_id
        // migration is confirmed and applied — see task tracking note.
        status: "pending",
        priority: "normal",
        created_by: "human",
      } as any);
      if (error) toast.error(error.message);
      else { toast.success("AI task created"); setCreateTaskOpen(false); fetchAll(); }
      return;
    }
    const { error } = await supabase.from("tasks").insert({
      title: data.title, project_id: data.project_id || null,
      goal_id: data.goal_id || null, description: data.description,
      assigned_to: data.assigned_to || user?.id, created_by: user?.id,
    });
    if (error) toast.error(error.message);
    else { toast.success("Task created"); setCreateTaskOpen(false); fetchAll(); }
  };

  const updateStatus = async (table: "goals" | "projects" | "tasks", id: string, status: string) => {
    const { error } = await supabase.from(table).update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else {
      // Auto-create next occurrence for recurring tasks
      if (table === "tasks" && status === "done") {
        const task = tasks.find(t => t.id === id);
        if (task?.is_recurring && task.recurrence_rule) {
          await createNextOccurrence(task);
        }
      }
      fetchAll();
    }
  };

  const createNextOccurrence = async (task: Task) => {
    const rule = task.recurrence_rule;
    if (!rule) return;
    // Check end date
    if (rule.end_date && new Date(rule.end_date) < new Date()) return;

    // Calculate next due date
    let nextDue: string | null = null;
    if (task.due_date) {
      const d = new Date(task.due_date);
      const interval = rule.interval || 1;
      switch (rule.frequency) {
        case "daily": d.setDate(d.getDate() + interval); break;
        case "weekly": d.setDate(d.getDate() + 7 * interval); break;
        case "monthly": d.setMonth(d.getMonth() + interval); break;
        case "custom": d.setDate(d.getDate() + interval); break;
      }
      nextDue = d.toISOString().split("T")[0];
    }

    const { error } = await supabase.from("tasks").insert({
      title: task.title,
      description: task.description,
      project_id: task.project_id,
      goal_id: task.goal_id,
      priority: task.priority,
      assigned_to: task.assigned_to,
      tags: task.tags,
      due_date: nextDue,
      is_recurring: true,
      recurrence_rule: rule,
      recurring_parent_id: task.recurring_parent_id || task.id,
      created_by: task.created_by,
    });
    if (!error) toast.success(nextDue ? `Next recurring task created — Due ${nextDue}` : "Next recurring task created");
  };

  // Issues handlers
  const createIssue = async () => {
    if (!newIssueTitle.trim()) return;
    const { error } = await supabase.from("issues").insert({
      title: newIssueTitle, description: newIssueDesc, priority: parseInt(newIssuePriority),
      raised_by: user?.id, department_id: newIssueDept || null,
      category: newIssueCategory, assigned_to: newIssueAssignee || null,
    });
    if (error) toast.error(error.message);
    else { toast.success("Issue raised"); setCreateIssueOpen(false); setNewIssueTitle(""); setNewIssueDesc(""); setNewIssueCategory("general"); setNewIssueAssignee(""); fetchAll(); }
  };

  const updateIssue = async (id: string, updates: Partial<Issue>) => {
    const { error } = await supabase.from("issues").update(updates).eq("id", id);
    if (error) toast.error(error.message);
    else {
      fetchAll();
      if (selectedIssue?.id === id) setSelectedIssue(prev => prev ? { ...prev, ...updates } : null);
    }
  };

  const solveWithTask = async (issue: Issue) => {
    const { data } = await supabase.from("tasks").insert({
      title: `[Issue] ${issue.title}`, description: issue.resolution || issue.root_cause,
      created_by: user?.id, assigned_to: user?.id,
    }).select().single();
    if (data) {
      await updateIssue(issue.id, { status: "solved", resolved_action_type: "todo", resolved_action_id: data.id });
      toast.success("Issue solved — task created");
    }
  };

  const solveWithProject = async (issue: Issue) => {
    const { data } = await supabase.from("projects").insert({
      title: `[Issue] ${issue.title}`, description: issue.resolution || issue.root_cause,
      created_by: user?.id, owner_id: user?.id,
    }).select().single();
    if (data) {
      await updateIssue(issue.id, { status: "solved", resolved_action_type: "project", resolved_action_id: data.id });
      toast.success("Issue solved — project created");
    }
  };

  const dismiss = async (issue: Issue) => {
    await updateIssue(issue.id, { status: "dismissed", resolved_action_type: "none" });
    toast.success("Issue dismissed");
  };

  const filteredIssues = issueCategoryFilter === "all" ? issues : issues.filter(i => i.category === issueCategoryFilter);
  const openIssues = filteredIssues.filter(i => !["solved", "dismissed"].includes(i.status));
  const resolvedIssues = filteredIssues.filter(i => ["solved", "dismissed"].includes(i.status));

  const openProjectDrawer = (p: any) => { setProjectPeekId(p.id); };
  const openTaskDrawer = (t: any) => { setTaskPeekId(t.id); };

  return (
    <div className="p-4 sm:p-6 max-w-[1600px] mx-auto space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Target className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Execution Hub</h1>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <TabsList>
            <TabsTrigger value="goals">Goals</TabsTrigger>
            <TabsTrigger value="projects">Projects</TabsTrigger>
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
            <TabsTrigger value="cadences" className="gap-1.5"><Repeat className="h-3.5 w-3.5" /> Cadences</TabsTrigger>
            {councilAllowed && <TabsTrigger value="council">Council</TabsTrigger>}
            <TabsTrigger value="issues" className="flex items-center gap-1.5">
              Issues
              {openIssues.length > 0 && (
                <span className="inline-flex items-center justify-center rounded-full bg-destructive/10 text-destructive text-[10px] font-semibold h-4 min-w-4 px-1">
                  {openIssues.length}
                </span>
              )}
            </TabsTrigger>
            {isAdmin && <TabsTrigger value="submissions">Submissions</TabsTrigger>}
            {isAdmin && <TabsTrigger value="lead-review">Lead Review</TabsTrigger>}
          </TabsList>
          <div className="flex gap-2">
            {tab === "goals" && (
              <CreateDialog title="New Goal" open={createGoalOpen} onOpenChange={setCreateGoalOpen}
                onSubmit={createGoal} type="goal" goals={goals} projects={projects}
                departments={departments} profiles={profiles} />
            )}
            {tab === "projects" && (
              <CreateDialog title="New Project" open={createProjectOpen} onOpenChange={setCreateProjectOpen}
                onSubmit={createProject} type="project" goals={goals} projects={projects}
                departments={departments} profiles={profiles} />
            )}
            {tab === "tasks" && (
              <div className="flex gap-2">
                <TaskTemplateManager
                  profiles={profiles}
                  onUseTemplate={(template) => {
                    const dueDate = template.due_date_offset_days
                      ? new Date(Date.now() + template.due_date_offset_days * 86400000).toISOString().split("T")[0]
                      : null;
                    supabase.from("tasks").insert({
                      title: template.title,
                      description: template.description,
                      priority: template.priority,
                      tags: template.tags,
                      subtasks: template.subtasks,
                      assigned_to: template.assignee_id || user?.id,
                      due_date: dueDate,
                      is_recurring: !!template.recurrence_rule,
                      recurrence_rule: template.recurrence_rule,
                      created_by: user?.id,
                    }).then(({ error }) => {
                      if (error) toast.error(error.message);
                      else { toast.success("Task created from template"); fetchAll(); }
                    });
                  }}
                />
                <CreateDialog title="New Task" open={createTaskOpen} onOpenChange={setCreateTaskOpen}
                  onSubmit={createTask} type="task" goals={goals} projects={projects}
                  departments={departments} profiles={profiles} agents={agentsMeta} repos={repos} />
              </div>
            )}
            {tab === "issues" && (
              <Dialog open={createIssueOpen} onOpenChange={setCreateIssueOpen}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Raise Issue</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Raise an Issue</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div><Label>Title</Label><Input value={newIssueTitle} onChange={e => setNewIssueTitle(e.target.value)} /></div>
                    <div><Label>Description</Label><Textarea value={newIssueDesc} onChange={e => setNewIssueDesc(e.target.value)} rows={3} /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Category</Label>
                        <Select value={newIssueCategory} onValueChange={setNewIssueCategory}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="general">General</SelectItem>
                            <SelectItem value="tools_systems">Tools & Systems</SelectItem>
                            <SelectItem value="process">Process</SelectItem>
                            <SelectItem value="change_request">Change Request</SelectItem>
                            <SelectItem value="people">People</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Priority</Label>
                        <Select value={newIssuePriority} onValueChange={setNewIssuePriority}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">High</SelectItem>
                            <SelectItem value="2">Medium</SelectItem>
                            <SelectItem value="3">Low</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Assign To</Label>
                        <Select value={newIssueAssignee} onValueChange={setNewIssueAssignee}>
                          <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                          <SelectContent>
                            {profiles.map(p => <SelectItem key={p.user_id} value={p.user_id}>{p.full_name || "Unknown"}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      {departments.length > 0 && (
                        <div>
                          <Label>Department</Label>
                          <Select value={newIssueDept} onValueChange={setNewIssueDept}>
                            <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                            <SelectContent>
                              {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                    <Button onClick={createIssue} className="w-full">Submit</Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {/* Goals tab — strategic dashboard */}
        <TabsContent value="goals" className="space-y-5">
          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={goalQuarter} onValueChange={setGoalQuarter}>
              <SelectTrigger className="h-8 w-32 text-xs"><SelectValue placeholder="Quarter" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All quarters</SelectItem>
                {["Q1","Q2","Q3","Q4"].map(q => <SelectItem key={q} value={q}>{q}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={goalYear} onValueChange={setGoalYear}>
              <SelectTrigger className="h-8 w-28 text-xs"><SelectValue placeholder="Year" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All years</SelectItem>
                {[currentYear(), currentYear() - 1, currentYear() + 1].map(y => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={goalDept} onValueChange={setGoalDept}>
              <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="Department" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All departments</SelectItem>
                {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>Group by</span>
              <Select value={goalGroupBy} onValueChange={(v: any) => setGoalGroupBy(v)}>
                <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="quarter">Quarter</SelectItem>
                  <SelectItem value="department">Department</SelectItem>
                  <SelectItem value="none">None</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Filtered + grouped grid */}
          {(() => {
            const filtered = goals.filter(g => {
              if (goalQuarter !== "all" && g.quarter !== goalQuarter) return false;
              if (goalYear !== "all" && String(g.year) !== goalYear) return false;
              if (goalDept !== "all" && g.department_id !== goalDept) return false;
              return true;
            });

            if (filtered.length === 0) {
              const isFiltered = goalQuarter !== "all" || goalYear !== "all" || goalDept !== "all";
              return (
                <EmptyState
                  icon={Target}
                  title={isFiltered ? "No goals match these filters" : "No goals yet"}
                  description={
                    isFiltered
                      ? "Try adjusting the quarter, year, or department filter — or set a new rock for this period."
                      : "Goals are your quarterly rocks — the few outcomes that matter most. Set the direction the team rallies behind."
                  }
                  actionLabel="New Goal"
                  actionIcon={Plus}
                  onAction={() => setCreateGoalOpen(true)}
                />
              );
            }

            const groups: Record<string, typeof filtered> = {};
            filtered.forEach(g => {
              let key = "All goals";
              if (goalGroupBy === "quarter") key = `${g.year} ${g.quarter}`;
              else if (goalGroupBy === "department") {
                key = g.department_id ? (departments.find(d => d.id === g.department_id)?.name || "Department") : "Unassigned";
              }
              (groups[key] = groups[key] || []).push(g);
            });

            const sortedKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a));

            return sortedKeys.map(key => (
              <div key={key} className="space-y-3">
                {goalGroupBy !== "none" && (
                  <div className="flex items-center gap-2 px-1">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{key}</h2>
                    <span className="text-[10px] text-muted-foreground/70">· {groups[key].length}</span>
                    <div className="flex-1 h-px bg-border/50" />
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {groups[key].map(goal => (
                    <GoalCard
                      key={goal.id}
                      goal={goal}
                      projects={projectsForGoal(goal.id)}
                      ownerName={getName(goal.owner_id)}
                      onClick={() => setPeekGoalId(goal.id)}
                    />
                  ))}
                </div>
              </div>
            ));
          })()}
        </TabsContent>

        {/* Projects tab */}
        <TabsContent value="projects" className="space-y-4">
          <ViewControls
            search={pv.search} onSearchChange={pv.setSearch}
            view={pv.view} onViewChange={pv.setView}
            sortField={pv.sortField} onSortFieldChange={pv.setSortField}
            sortDir={pv.sortDir} onSortDirChange={pv.setSortDir}
            filterStatus={pv.filterStatus} onFilterStatusChange={pv.setFilterStatus}
            filterPriority={pv.filterPriority} onFilterPriorityChange={pv.setFilterPriority}
            statusOptions={projectStatusOptions}
            priorityOptions={priorityOptions}
          />

          {filteredProjects.length === 0 ? (
            <EmptyState
              icon={FolderKanban}
              title={projects.length === 0 ? "No projects yet" : "No projects match these filters"}
              description={
                projects.length === 0
                  ? "Projects are how goals turn into action — group related work, assign an owner, and track it through to done."
                  : "Try clearing a filter, or kick off a new project to move a goal forward."
              }
              actionLabel="New Project"
              actionIcon={Plus}
              onAction={() => setCreateProjectOpen(true)}
            />
          ) : (
            <>
              {pv.view === "list" && (
                <TableView
                  items={filteredProjects}
                  type="project"
                  onItemClick={openProjectDrawer}
                  onStatusChange={(id, status) => updateStatus("projects", id, status)}
                  getName={getName}
                  statusOptions={projectStatusOptions}
                  goals={goals}
                />
              )}

              {pv.view === "board" && (
                <KanbanBoard
                  columns={projectKanbanCols}
                  items={filteredProjects}
                  statusField="status"
                  onItemClick={openProjectDrawer}
                  onStatusChange={(id, status) => updateStatus("projects", id, status)}
                  getName={getName}
                  ownerField="owner_id"
                  type="project"
                  profiles={profiles}
                />
              )}

              {pv.view === "table" && (
                <DataTableView
                  items={filteredProjects}
                  type="project"
                  onItemClick={openProjectDrawer}
                  onStatusChange={(id, status) => updateStatus("projects", id, status)}
                  onUpdate={async (id, patch) => {
                    const { error } = await supabase.from("projects").update(patch as any).eq("id", id);
                    if (error) toast.error(error.message);
                    else fetchAll();
                  }}
                  getName={getName}
                  statusOptions={projectStatusOptions}
                  profiles={profiles}
                  goals={goals}
                />
              )}
            </>
          )}
        </TabsContent>

        {/* Tasks tab — unified human + AI task feed, same filters/badges across all 3 view modes */}
        <TabsContent value="tasks" className="space-y-4">
          <ViewControls
            search={tv.search} onSearchChange={tv.setSearch}
            view={tv.view} onViewChange={tv.setView}
            sortField={tv.sortField} onSortFieldChange={tv.setSortField}
            sortDir={tv.sortDir} onSortDirChange={tv.setSortDir}
            filterStatus={tv.filterStatus} onFilterStatusChange={tv.setFilterStatus}
            filterPriority={tv.filterPriority} onFilterPriorityChange={tv.setFilterPriority}
            statusOptions={taskStatusOptions}
            priorityOptions={priorityOptions}
          />

          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex gap-1.5 flex-wrap">
              {([
                { key: "all", label: "All" },
                { key: "mine", label: "My tasks" },
                { key: "ai", label: "AI tasks" },
              ] as const).map(f => (
                <Button
                  key={f.key}
                  size="sm"
                  variant={taskSourceFilter === f.key ? "default" : "outline"}
                  className="h-7 text-xs"
                  onClick={() => setTaskSourceFilter(f.key)}
                >
                  {f.label}
                </Button>
              ))}
              <Button
                size="sm"
                variant={taskSourceFilter === "needs_input" ? "default" : "outline"}
                className={`h-7 text-xs ${taskSourceFilter !== "needs_input" ? "border-red-200 text-red-700 hover:bg-red-50" : ""}`}
                onClick={() => setTaskSourceFilter("needs_input")}
              >
                Needs input {needsInputCount > 0 && `(${needsInputCount})`}
              </Button>
            </div>
            <div className="flex items-center gap-3">
              {tv.view !== "board" && (
                <Select value={taskGroupBy} onValueChange={(v) => setTaskGroupBy(v as any)}>
                  <SelectTrigger className="w-36 h-7 text-xs">
                    <SelectValue placeholder="Group by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No grouping</SelectItem>
                    <SelectItem value="status">Group: Status</SelectItem>
                    <SelectItem value="priority">Group: Priority</SelectItem>
                    <SelectItem value="due_date">Group: Due Date</SelectItem>
                    <SelectItem value="assignee">Group: Assignee</SelectItem>
                  </SelectContent>
                </Select>
              )}
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                <Checkbox checked={showSystemTasks} onCheckedChange={(v) => setShowSystemTasks(!!v)} />
                Show system tasks ({systemHiddenCount} hidden)
              </label>
            </div>
          </div>

          {(() => {
            const HumanCard = ({ t }: { t: Task }) => (
              <Card key={`h-${t.id}`} className="cursor-pointer hover:bg-accent/30 transition-colors" onClick={() => openTaskDrawer(t)}>
                <CardContent className="py-3 flex items-center gap-3">
                  <span className="flex items-center justify-center h-7 w-7 rounded-full bg-secondary text-[11px] font-medium shrink-0">
                    {getName(t.assigned_to).split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{t.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{getName(t.assigned_to)}</p>
                  </div>
                  <SharedStatusBadge
                    label={taskStatusOptions.find(s => s.value === t.status)?.label || t.status}
                    variant={TASK_STATUS_VARIANT[t.status] ?? "default"}
                    dot
                  />
                </CardContent>
              </Card>
            );

            const AgentCard = ({ t }: { t: AgentTask }) => {
              const meta = getAgentMeta(t.assigned_to);
              const badge = AGENT_STATUS_BADGE[t.status] ?? { label: t.status, cls: "bg-muted text-muted-foreground" };
              return (
                <Card key={`a-${t.id}`} className="cursor-pointer hover:bg-accent/30 transition-colors" onClick={() => setAgentTaskPeekId(t.id)}>
                  <CardContent className="py-3 flex items-center gap-3">
                    <span
                      className="flex items-center justify-center h-7 w-7 rounded-full text-white shrink-0"
                      style={{ background: meta?.accent_color || "#7F77DD" }}
                    >
                      {meta?.emoji ?? <Sparkles className="h-3.5 w-3.5" />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{t.title}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {meta?.name || t.assigned_to} · AI agent{t.is_system_task ? " · system" : ""}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${badge.cls}`}>
                      {badge.label}
                    </span>
                  </CardContent>
                </Card>
              );
            };

            const Row = ({ row }: { row: UnifiedRow }) => row.kind === "human" ? <HumanCard t={row.task} /> : <AgentCard t={row.task} />;

            if (tv.view === "list") {
              if (unifiedFeed.length === 0) {
                return <Card><CardContent className="py-12 text-center text-muted-foreground">No tasks.</CardContent></Card>;
              }
              return (
                <div className="space-y-6">
                  {groupedUnifiedFeed.map(grp => (
                    <div key={grp.key} className="space-y-2">
                      {taskGroupBy !== "none" && (
                        <div className="flex items-center gap-2 px-1">
                          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{grp.label}</h3>
                          <span className="text-xs text-muted-foreground">{grp.rows.length}</span>
                        </div>
                      )}
                      <div className="flex flex-col gap-2">
                        {grp.rows.map(row => <Row key={`${row.kind}-${row.task.id}`} row={row} />)}
                      </div>
                    </div>
                  ))}
                </div>
              );
            }

            if (tv.view === "board") {
              // Buckets agent_tasks into the same 4 columns human tasks use
              // (statusBucket is shared with the "Group by: Status" option
              // below, so board layout and grouped list/table line up).
              return (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  {taskKanbanCols.map(col => {
                    const colRows = unifiedFeed.filter(row => statusBucket(row) === col.key);
                    return (
                      <div key={col.key} className="flex flex-col gap-2">
                        <div className="flex items-center gap-2 rounded-lg border-l-4 bg-card px-3 py-2" style={{ borderLeftColor: col.color }}>
                          <span className="text-sm font-semibold">{col.label}</span>
                          <span className="ml-auto rounded-full bg-secondary px-2 py-0.5 text-[11px] font-mono">{colRows.length}</span>
                        </div>
                        <div className="flex flex-col gap-2 max-h-[65vh] overflow-y-auto">
                          {colRows.length === 0 ? (
                            <div className="rounded-lg border border-dashed border-border/50 p-4 text-center text-xs text-muted-foreground">No tasks</div>
                          ) : colRows.map(row => <Row key={`${row.kind}-${row.task.id}`} row={row} />)}
                          {col.key !== "done" && (
                            <button
                              className="text-left text-xs text-muted-foreground hover:text-foreground px-3 py-1.5"
                              onClick={() => {
                                const title = window.prompt("Task title");
                                if (!title?.trim() || !user) return;
                                supabase.from("tasks").insert({
                                  title: title.trim(),
                                  status: col.key,
                                  created_by: user.id,
                                } as any).then(({ error }) => {
                                  if (error) toast.error(error.message);
                                  else fetchAll();
                                });
                              }}
                            >
                              + Add card
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            }

            // Table view
            return (
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs text-muted-foreground">
                    <tr>
                      <th className="text-left font-medium px-3 py-2">Title</th>
                      <th className="text-left font-medium px-3 py-2">Assignee</th>
                      <th className="text-left font-medium px-3 py-2">Status</th>
                      <th className="text-left font-medium px-3 py-2">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {unifiedFeed.length === 0 ? (
                      <tr><td colSpan={4} className="text-center text-muted-foreground py-10">No tasks.</td></tr>
                    ) : groupedUnifiedFeed.map(grp => (
                      <Fragment key={grp.key}>
                        {taskGroupBy !== "none" && (
                          <tr key={`grp-${grp.key}`} className="bg-muted/30">
                            <td colSpan={4} className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              {grp.label} <span className="font-normal text-muted-foreground/70">· {grp.rows.length}</span>
                            </td>
                          </tr>
                        )}
                        {grp.rows.map(row => {
                          if (row.kind === "human") {
                            const t = row.task;
                            return (
                              <tr key={`h-${t.id}`} className="cursor-pointer hover:bg-accent/30" onClick={() => openTaskDrawer(t)}>
                                <td className="px-3 py-2">{t.title}</td>
                                <td className="px-3 py-2 text-muted-foreground">{getName(t.assigned_to)}</td>
                                <td className="px-3 py-2">
                                  <SharedStatusBadge
                                    label={taskStatusOptions.find(s => s.value === t.status)?.label || t.status}
                                    variant={TASK_STATUS_VARIANT[t.status] ?? "default"}
                                    dot
                                  />
                                </td>
                                <td className="px-3 py-2 text-muted-foreground">{new Date(t.created_at).toLocaleDateString()}</td>
                              </tr>
                            );
                          }
                          const t = row.task;
                          const meta = getAgentMeta(t.assigned_to);
                          const badge = AGENT_STATUS_BADGE[t.status] ?? { label: t.status, cls: "bg-muted text-muted-foreground" };
                          return (
                            <tr key={`a-${t.id}`} className="cursor-pointer hover:bg-accent/30" onClick={() => setAgentTaskPeekId(t.id)}>
                              <td className="px-3 py-2 flex items-center gap-2">
                                <Sparkles className="h-3 w-3 shrink-0" style={{ color: meta?.accent_color || "#7F77DD" }} />
                                {t.title}
                              </td>
                              <td className="px-3 py-2 text-muted-foreground">{meta?.name || t.assigned_to} · AI{t.is_system_task ? " · system" : ""}</td>
                              <td className="px-3 py-2">
                                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${badge.cls}`}>{badge.label}</span>
                              </td>
                              <td className="px-3 py-2 text-muted-foreground">{new Date(t.created_at).toLocaleDateString()}</td>
                            </tr>
                          );
                        })}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </TabsContent>

        {/* Cadences tab */}
        <TabsContent value="cadences" className="space-y-4">
          <CadencesTab />
        </TabsContent>

        {/* Council tab — cross-project multi-agent Q&A, admin-grant gated */}
        {councilAllowed && (
          <TabsContent value="council" className="space-y-4">
            <CouncilPanel />
          </TabsContent>
        )}

        {/* Issues tab */}
        <TabsContent value="issues" className="space-y-4">
          {/* Category filter */}
          <div className="flex gap-1 flex-wrap">
            {[
              { value: "all", label: "All" },
              { value: "tools_systems", label: "Tools & Systems" },
              { value: "process", label: "Process" },
              { value: "change_request", label: "Change Requests" },
              { value: "people", label: "People" },
              { value: "general", label: "General" },
            ].map(cat => (
              <Button
                key={cat.value}
                variant={issueCategoryFilter === cat.value ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setIssueCategoryFilter(cat.value)}
              >
                {cat.label}
              </Button>
            ))}
          </div>

          <Tabs value={issueViewTab} onValueChange={setIssueViewTab}>
            <TabsList>
              <TabsTrigger value="open">Open ({openIssues.length})</TabsTrigger>
              <TabsTrigger value="resolved">Resolved ({resolvedIssues.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="open" className="space-y-3">
              {openIssues.map(issue => (
                <Card key={issue.id} className="cursor-pointer hover:bg-accent/30 transition-colors" onClick={() => setSelectedIssue(issue)}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium">{issue.title}</h3>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <SharedStatusBadge label={PRIORITY_LABEL[issue.priority] ?? "Medium"} variant={PRIORITY_VARIANT[issue.priority] ?? "warning"} dot />
                          <Badge variant="outline" className="text-xs capitalize">{(issue.category || "general").replace("_", " ")}</Badge>
                          <span className="text-xs text-muted-foreground">by {getName(issue.raised_by)}</span>
                          {issue.assigned_to && <span className="text-xs text-muted-foreground">→ {getName(issue.assigned_to)}</span>}
                          <Badge variant="outline" className="text-xs capitalize">{issue.status}</Badge>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              ))}
              {openIssues.length === 0 && (
                <Card><CardContent className="py-12 text-center text-muted-foreground">No open issues. 🎉</CardContent></Card>
              )}
            </TabsContent>

            <TabsContent value="resolved" className="space-y-3">
              {resolvedIssues.map(issue => (
                <Card key={issue.id} className="opacity-70">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium">{issue.title}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className="text-xs capitalize">{issue.status}</Badge>
                          <Badge variant="outline" className="text-xs capitalize">{(issue.category || "general").replace("_", " ")}</Badge>
                          {issue.resolved_action_type !== "none" && (
                            <Badge variant="outline" className="text-xs">→ {issue.resolved_action_type}</Badge>
                          )}
                          {issue.resolution && <span className="text-xs text-muted-foreground truncate max-w-60">{issue.resolution}</span>}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {resolvedIssues.length === 0 && (
                <Card><CardContent className="py-12 text-center text-muted-foreground">No resolved issues yet.</CardContent></Card>
              )}
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* Submissions tab */}
        {isAdmin && (
          <TabsContent value="submissions" className="space-y-4">
            <SubmissionsReviewTab />
          </TabsContent>
        )}

        {/* Lead Review tab */}
        {isAdmin && (
          <TabsContent value="lead-review" className="space-y-4">
            <LeadReviewTab />
          </TabsContent>
        )}
      </Tabs>

      {/* Issue Detail Dialog */}
      <Dialog open={!!selectedIssue} onOpenChange={o => !o && setSelectedIssue(null)}>
        <DialogContent className="max-w-lg">
          {selectedIssue && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" /> {selectedIssue.title}
                </DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">{selectedIssue.description}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs capitalize">{(selectedIssue.category || "general").replace("_", " ")}</Badge>
                <SharedStatusBadge label={PRIORITY_LABEL[selectedIssue.priority] ?? "Medium"} variant={PRIORITY_VARIANT[selectedIssue.priority] ?? "warning"} dot />
                {selectedIssue.assigned_to && <span className="text-xs text-muted-foreground">Assigned: {getName(selectedIssue.assigned_to)}</span>}
                <span className="text-xs text-muted-foreground">Raised by: {getName(selectedIssue.raised_by)}</span>
              </div>

              <div className="space-y-4 mt-2">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Search className="h-4 w-4 text-primary" />
                    <h4 className="font-medium text-sm">1. Identify — Root Cause</h4>
                  </div>
                  <Textarea
                    value={selectedIssue.root_cause || ""}
                    onChange={e => setSelectedIssue(p => p ? { ...p, root_cause: e.target.value } : null)}
                    placeholder="What is the real, underlying issue?"
                    rows={2}
                  />
                  {selectedIssue.status === "open" && (
                    <Button size="sm" variant="outline" onClick={() => updateIssue(selectedIssue.id, { status: "identifying", root_cause: selectedIssue.root_cause })}>
                      Save & Move to Discuss <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    <h4 className="font-medium text-sm">2. Discuss</h4>
                  </div>
                  <Textarea
                    value={selectedIssue.discussion_notes || ""}
                    onChange={e => setSelectedIssue(p => p ? { ...p, discussion_notes: e.target.value } : null)}
                    placeholder="Key discussion points and perspectives..."
                    rows={3}
                  />
                  {["open", "identifying"].includes(selectedIssue.status) && (
                    <Button size="sm" variant="outline" onClick={() => updateIssue(selectedIssue.id, { status: "discussing", discussion_notes: selectedIssue.discussion_notes, root_cause: selectedIssue.root_cause })}>
                      Save & Move to Solve <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-primary" />
                    <h4 className="font-medium text-sm">3. Solve</h4>
                  </div>
                  <Textarea
                    value={selectedIssue.resolution || ""}
                    onChange={e => setSelectedIssue(p => p ? { ...p, resolution: e.target.value } : null)}
                    placeholder="Resolution / action to take..."
                    rows={2}
                  />
                  {!["solved", "dismissed"].includes(selectedIssue.status) && (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => {
                        updateIssue(selectedIssue.id, { root_cause: selectedIssue.root_cause, discussion_notes: selectedIssue.discussion_notes, resolution: selectedIssue.resolution });
                        solveWithTask(selectedIssue);
                        setSelectedIssue(null);
                      }}>
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Create Task
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => {
                        updateIssue(selectedIssue.id, { root_cause: selectedIssue.root_cause, discussion_notes: selectedIssue.discussion_notes, resolution: selectedIssue.resolution });
                        solveWithProject(selectedIssue);
                        setSelectedIssue(null);
                      }}>
                        Create Project
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => {
                        updateIssue(selectedIssue.id, { root_cause: selectedIssue.root_cause, discussion_notes: selectedIssue.discussion_notes, resolution: selectedIssue.resolution });
                        dismiss(selectedIssue);
                        setSelectedIssue(null);
                      }}>
                        <X className="h-3 w-3 mr-1" /> Dismiss
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <ProjectPeek
        projectId={projectPeekId}
        onClose={() => setProjectPeekId(null)}
        onChanged={() => {
          (async () => {
            const { data } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
            if (data) setProjects(data);
          })();
        }}
      />

      {taskPeekId && (
        <TaskPeek
          id={taskPeekId}
          open={!!taskPeekId}
          onClose={() => setTaskPeekId(null)}
        />
      )}

      {agentTaskPeekId && (
        <AgentTaskDetail
          taskId={agentTaskPeekId}
          open={!!agentTaskPeekId}
          onClose={() => setAgentTaskPeekId(null)}
        />
      )}

      {/* Goal Peek */}
      <GoalPeek
        goalId={peekGoalId}
        onClose={() => setPeekGoalId(null)}
        allProjects={projects as any}
        getName={getName}
        onChanged={fetchAll}
        onOpenProject={(pid) => {
          const p = projects.find(x => x.id === pid);
          if (p) { setPeekGoalId(null); openProjectDrawer(p); }
        }}
      />
    </div>
  );
}

// Submissions review tab for form submissions
function SubmissionsReviewTab() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [reviewFilter, setReviewFilter] = useState("pending");
  const { user } = useAuth();

  const fetchData = useCallback(async () => {
    const [tRes, sRes] = await Promise.all([
      supabase.from("form_templates").select("*"),
      supabase.from("form_submissions").select("*").order("created_at", { ascending: false }),
    ]);
    if (tRes.data) setTemplates(tRes.data);
    if (sRes.data) setSubmissions(sRes.data);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const getTemplateName = (id: string) => templates.find((t: any) => t.id === id)?.name || "Unknown";

  const updateStatus = async (id: string, status: string, notes?: string) => {
    await supabase.from("form_submissions").update({
      status,
      reviewed_by: user?.id,
      review_notes: notes || "",
    } as any).eq("id", id);
    fetchData();
    toast.success(`Submission ${status}`);
  };

  const filtered = reviewFilter === "all"
    ? submissions
    : submissions.filter(s => s.status === reviewFilter);

  const pendingCount = submissions.filter(s => s.status === "pending").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5">
          {["pending", "approved", "denied", "all"].map(f => (
            <Button
              key={f}
              size="sm"
              variant={reviewFilter === f ? "default" : "outline"}
              className="h-7 text-xs capitalize"
              onClick={() => setReviewFilter(f)}
            >
              {f}
              {f === "pending" && pendingCount > 0 && (
                <span className="ml-1 inline-flex items-center justify-center rounded-full bg-primary-foreground/20 text-[10px] font-semibold h-4 min-w-4 px-1">
                  {pendingCount}
                </span>
              )}
            </Button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No {reviewFilter === "all" ? "" : reviewFilter} submissions.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(s => (
            <Card key={s.id}>
              <CardContent className="p-4 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium">{getTemplateName(s.template_id)}</p>
                    <Badge variant={s.status === "pending" ? "secondary" : s.status === "approved" ? "default" : "destructive"} className="text-[10px] capitalize">
                      {s.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{new Date(s.created_at).toLocaleDateString()}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {Object.entries(s.values as Record<string, any>).map(([k, v]) => (
                      <Badge key={k} variant="outline" className="text-[10px]">{k}: {String(v)}</Badge>
                    ))}
                  </div>
                  {s.review_notes && <p className="text-xs text-muted-foreground mt-1 italic">Note: {s.review_notes}</p>}
                </div>
                {s.status === "pending" && (
                  <div className="flex gap-1.5 shrink-0">
                    <Button size="sm" variant="outline" className="h-7 text-xs text-green-600" onClick={() => updateStatus(s.id, "approved")}>Approve</Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs text-red-600" onClick={() => updateStatus(s.id, "denied")}>Deny</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// Unified create dialog — de-formed style
function CreateDialog({ title, open, onOpenChange, onSubmit, type, goals, projects, departments, profiles, agents = [], repos = [] }: {
  title: string; open: boolean; onOpenChange: (o: boolean) => void;
  onSubmit: (data: any) => void; type: "goal" | "project" | "task";
  goals: Goal[]; projects: Project[];
  departments: { id: string; name: string }[];
  profiles: { user_id: string; full_name: string | null }[];
  agents?: AgentMeta[];
  repos?: { slug: string; name: string; github_repo: string }[];
}) {
  const [form, setForm] = useState<Record<string, string>>({});
  const [showDesc, setShowDesc] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSubmit = () => {
    if (!form.title?.trim()) { toast.error("Title required"); return; }
    onSubmit({
      ...form,
      year: form.year ? parseInt(form.year) : currentYear(),
      quarter: form.quarter || currentQuarter(),
    });
    setForm({});
    setShowDesc(false);
    setShowAdvanced(false);
  };

  const quarters = ["Q1", "Q2", "Q3", "Q4"];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4 mr-1" /> {title}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input
            value={form.title || ""}
            onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
            placeholder={`${type.charAt(0).toUpperCase() + type.slice(1)} name...`}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
            autoFocus
          />

          {!showDesc ? (
            <button onClick={() => setShowDesc(true)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              + Add description
            </button>
          ) : (
            <Textarea
              value={form.description || ""}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder="Description..."
              rows={2}
              className="text-sm"
            />
          )}

          {type === "goal" && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Quarter</span>
                <div className="flex gap-1">
                  {quarters.map(q => (
                    <button
                      key={q}
                      onClick={() => setForm(p => ({ ...p, quarter: q }))}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                        (form.quarter || currentQuarter()) === q
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
                <Input
                  type="number"
                  value={form.year || currentYear()}
                  onChange={e => setForm(p => ({ ...p, year: e.target.value }))}
                  className="w-20 h-8 text-xs"
                />
              </div>

              {!showAdvanced ? (
                <button onClick={() => setShowAdvanced(true)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                  + Target, deadline & alignment
                </button>
              ) : (
                <div className="space-y-2">
                  <Input value={form.measurable_target || ""} onChange={e => setForm(p => ({ ...p, measurable_target: e.target.value }))} placeholder="Measurable target, e.g. Increase revenue by 20%" className="text-sm" />
                  <Input type="date" value={form.deadline || ""} onChange={e => setForm(p => ({ ...p, deadline: e.target.value }))} className="text-sm" />
                  <Textarea value={form.alignment_notes || ""} onChange={e => setForm(p => ({ ...p, alignment_notes: e.target.value }))} rows={2} placeholder="How does this align with company strategy?" className="text-sm" />
                </div>
              )}
            </>
          )}

          {type === "project" && goals.length > 0 && (
            <Select value={form.goal_id || ""} onValueChange={v => setForm(p => ({ ...p, goal_id: v }))}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="+ Link to goal" /></SelectTrigger>
              <SelectContent>
                {goals.map(g => <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>)}
              </SelectContent>
            </Select>
          )}

          {type === "task" && (
            <>
              <div className="flex gap-2">
                {projects.length > 0 && (
                  <Select value={form.project_id || ""} onValueChange={v => setForm(p => ({ ...p, project_id: v }))}>
                    <SelectTrigger className="h-9 text-sm flex-1"><SelectValue placeholder="+ Project" /></SelectTrigger>
                    <SelectContent>
                      {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
                <Select value={form.assigned_to || ""} onValueChange={v => setForm(p => ({ ...p, assigned_to: v }))}>
                  <SelectTrigger className="h-9 text-sm flex-1"><SelectValue placeholder="+ Assign" /></SelectTrigger>
                  <SelectContent>
                    {agents.length > 0 && <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">AI agents</div>}
                    {agents.map(a => <SelectItem key={a.slug} value={a.slug}>{a.name}</SelectItem>)}
                    {profiles.length > 0 && <div className="px-2 py-1 text-xs font-semibold text-muted-foreground mt-1">People</div>}
                    {profiles.map(p => <SelectItem key={p.user_id} value={p.user_id}>{p.full_name || "Unknown"}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {agents.some(a => a.slug === form.assigned_to) && (
                <div className="flex gap-2">
                  <Select value={form.agent_type || "general"} onValueChange={v => setForm(p => ({ ...p, agent_type: v }))}>
                    <SelectTrigger className="h-9 text-sm flex-1"><SelectValue placeholder="Type" /></SelectTrigger>
                    <SelectContent>
                      {["general", "research", "code", "decision", "communication"].map(t => (
                        <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={form.agent_repo || ""} onValueChange={v => setForm(p => ({ ...p, agent_repo: v }))}>
                    <SelectTrigger className="h-9 text-sm flex-1"><SelectValue placeholder="+ Repo (optional)" /></SelectTrigger>
                    <SelectContent>
                      {repos.map(r => <SelectItem key={r.slug} value={r.slug}>{r.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}

          {(type === "goal" || type === "project") && departments.length > 0 && (
            <Select value={form.department_id || ""} onValueChange={v => setForm(p => ({ ...p, department_id: v }))}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="+ Department" /></SelectTrigger>
              <SelectContent>
                {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}

          <div className="flex justify-end pt-1">
            <Button onClick={handleSubmit} size="sm">Create</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
