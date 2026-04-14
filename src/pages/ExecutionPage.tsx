import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDepartments } from "@/contexts/DepartmentsContext";
import DetailDrawer from "@/components/DetailDrawer";
import ViewControls, { ViewMode, SortField, SortDir } from "@/components/execution/ViewControls";
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
  User, Repeat,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import TaskTemplateManager from "@/components/TaskTemplateManager";

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
  { value: "done", label: "Done" },
];

const priorityOptions = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

const projectKanbanCols = [
  { key: "not_started", label: "Not Started", color: "bg-muted-foreground" },
  { key: "in_progress", label: "In Progress", color: "bg-blue-500" },
  { key: "blocked", label: "Blocked", color: "bg-red-500" },
  { key: "done", label: "Done", color: "bg-green-500" },
];

const taskKanbanCols = [
  { key: "todo", label: "To Do", color: "bg-muted-foreground" },
  { key: "in_progress", label: "In Progress", color: "bg-blue-500" },
  { key: "done", label: "Done", color: "bg-green-500" },
];

const priorityOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

const currentQuarter = () => { const m = new Date().getMonth(); return `Q${Math.floor(m / 3) + 1}`; };
const currentYear = () => new Date().getFullYear();

function useViewState() {
  const [search, setSearch] = useState("");
  const [view, setView] = useState<ViewMode>("list");
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
  const { departments } = useDepartments();
  const navigate = useNavigate();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [profiles, setProfiles] = useState<{ user_id: string; full_name: string | null }[]>([]);
  const [tab, setTab] = useState("goals");
  const [createGoalOpen, setCreateGoalOpen] = useState(false);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [drawerItem, setDrawerItem] = useState<any>(null);
  const [drawerType, setDrawerType] = useState<"project" | "task">("project");

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
  const pv = useViewState();
  const tv = useViewState();

  const fetchAll = useCallback(async () => {
    const [g, p, t, pr, i] = await Promise.all([
      supabase.from("goals").select("*").order("year", { ascending: false }).order("quarter"),
      supabase.from("projects").select("*").order("created_at", { ascending: false }),
      supabase.from("tasks").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("user_id, full_name"),
      supabase.from("issues").select("*").order("priority").order("created_at", { ascending: false }),
    ]);
    if (g.data) setGoals(g.data as any);
    if (p.data) setProjects(p.data as any);
    if (t.data) setTasks(t.data as any);
    if (pr.data) setProfiles(pr.data);
    if (i.data) setIssues(i.data as any);
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
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Goal created" }); setCreateGoalOpen(false); fetchAll(); }
  };

  const createProject = async (data: { title: string; goal_id: string; description: string; department_id: string }) => {
    const { error } = await supabase.from("projects").insert({
      title: data.title, goal_id: data.goal_id || null,
      description: data.description, department_id: data.department_id || null,
      owner_id: user?.id, created_by: user?.id,
    });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Project created" }); setCreateProjectOpen(false); fetchAll(); }
  };

  const createTask = async (data: { title: string; project_id: string; goal_id: string; description: string; assigned_to: string }) => {
    const { error } = await supabase.from("tasks").insert({
      title: data.title, project_id: data.project_id || null,
      goal_id: data.goal_id || null, description: data.description,
      assigned_to: data.assigned_to || user?.id, created_by: user?.id,
    });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Task created" }); setCreateTaskOpen(false); fetchAll(); }
  };

  const updateStatus = async (table: "goals" | "projects" | "tasks", id: string, status: string) => {
    const { error } = await supabase.from(table).update({ status }).eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
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
    if (!error) toast({ title: "Next recurring task created", description: nextDue ? `Due ${nextDue}` : undefined });
  };

  // Issues handlers
  const createIssue = async () => {
    if (!newIssueTitle.trim()) return;
    const { error } = await supabase.from("issues").insert({
      title: newIssueTitle, description: newIssueDesc, priority: parseInt(newIssuePriority),
      raised_by: user?.id, department_id: newIssueDept || null,
      category: newIssueCategory, assigned_to: newIssueAssignee || null,
    });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Issue raised" }); setCreateIssueOpen(false); setNewIssueTitle(""); setNewIssueDesc(""); setNewIssueCategory("general"); setNewIssueAssignee(""); fetchAll(); }
  };

  const updateIssue = async (id: string, updates: Partial<Issue>) => {
    const { error } = await supabase.from("issues").update(updates).eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
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
      toast({ title: "Issue solved — task created" });
    }
  };

  const solveWithProject = async (issue: Issue) => {
    const { data } = await supabase.from("projects").insert({
      title: `[Issue] ${issue.title}`, description: issue.resolution || issue.root_cause,
      created_by: user?.id, owner_id: user?.id,
    }).select().single();
    if (data) {
      await updateIssue(issue.id, { status: "solved", resolved_action_type: "project", resolved_action_id: data.id });
      toast({ title: "Issue solved — project created" });
    }
  };

  const dismiss = async (issue: Issue) => {
    await updateIssue(issue.id, { status: "dismissed", resolved_action_type: "none" });
    toast({ title: "Issue dismissed" });
  };

  const filteredIssues = issueCategoryFilter === "all" ? issues : issues.filter(i => i.category === issueCategoryFilter);
  const openIssues = filteredIssues.filter(i => !["solved", "dismissed"].includes(i.status));
  const resolvedIssues = filteredIssues.filter(i => ["solved", "dismissed"].includes(i.status));

  const StatusBadge = ({ status }: { status: string }) => {
    const cfg = statusConfig[status] || { label: status, color: "bg-muted text-muted-foreground", icon: Circle };
    return <Badge variant="secondary" className={`${cfg.color} text-xs`}>{cfg.label}</Badge>;
  };

  // Shared click handlers
  const openProjectDrawer = (p: any) => { setDrawerType("project"); setDrawerItem(p); };
  const openTaskDrawer = (t: any) => { setDrawerType("task"); setDrawerItem(t); };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Target className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Execution Hub</h1>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="goals">Goals</TabsTrigger>
            <TabsTrigger value="projects">Projects</TabsTrigger>
            <TabsTrigger value="tasks">My Tasks</TabsTrigger>
            <TabsTrigger value="issues" className="flex items-center gap-1.5">
              Issues
              {openIssues.length > 0 && (
                <span className="inline-flex items-center justify-center rounded-full bg-destructive/10 text-destructive text-[10px] font-semibold h-4 min-w-4 px-1">
                  {openIssues.length}
                </span>
              )}
            </TabsTrigger>
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
                      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
                      else { toast({ title: "Task created from template" }); fetchAll(); }
                    });
                  }}
                />
                <CreateDialog title="New Task" open={createTaskOpen} onOpenChange={setCreateTaskOpen}
                  onSubmit={createTask} type="task" goals={goals} projects={projects}
                  departments={departments} profiles={profiles} />
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

        {/* Goals tab */}
        <TabsContent value="goals" className="space-y-6">
          {Object.entries(goalsByQuarter).sort(([a], [b]) => b.localeCompare(a)).map(([qKey, qGoals]) => (
            <div key={qKey} className="space-y-3">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" /> {qKey}
              </h2>
              {qGoals.map(goal => {
                const gProjects = projectsForGoal(goal.id);
                const gTasks = tasksForGoal(goal.id);
                const allTasks = [...gTasks, ...gProjects.flatMap(p => tasksForProject(p.id))];
                const doneTasks = allTasks.filter(t => t.status === "done").length;
                const progress = allTasks.length > 0 ? Math.round((doneTasks / allTasks.length) * 100) : goal.progress;

                return (
                  <Collapsible key={goal.id}>
                    <Card>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            <CollapsibleTrigger className="hover:bg-accent p-1 rounded">
                              <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
                            </CollapsibleTrigger>
                            <div className="flex-1">
                              <CardTitle className="text-base">{goal.title}</CardTitle>
                              <p className="text-xs text-muted-foreground mt-1">{getName(goal.owner_id)}</p>
                            </div>
                            <StatusBadge status={goal.status} />
                            <Select value={goal.status} onValueChange={v => updateStatus("goals", goal.id, v)}>
                              <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {["on_track","behind","at_risk","done","not_done"].map(s => (
                                  <SelectItem key={s} value={s}>{statusConfig[s]?.label || s}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="mt-2 flex items-center gap-3">
                          <Progress value={progress} className="flex-1 h-2" />
                          <span className="text-xs text-muted-foreground w-10 text-right">{progress}%</span>
                        </div>
                      </CardHeader>
                      <CollapsibleContent>
                        <CardContent className="pt-0 space-y-3">
                          {goal.description && <p className="text-sm text-muted-foreground">{goal.description}</p>}
                          {goal.measurable_target && (
                            <div className="text-xs"><span className="font-medium">Target:</span> <span className="text-muted-foreground">{goal.measurable_target}</span></div>
                          )}
                          {goal.deadline && (
                            <div className="text-xs"><span className="font-medium">Deadline:</span> <span className="text-muted-foreground">{goal.deadline}</span></div>
                          )}
                          {goal.alignment_notes && (
                            <div className="text-xs"><span className="font-medium">Alignment:</span> <span className="text-muted-foreground">{goal.alignment_notes}</span></div>
                          )}
                          {Array.isArray(goal.key_results) && goal.key_results.length > 0 && (
                            <div className="space-y-1">
                              <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Key Results</h4>
                              {goal.key_results.map((kr: any, i: number) => (
                                <div key={i} className="flex items-center gap-2 text-sm">
                                  <Checkbox
                                    checked={!!kr.done}
                                    onCheckedChange={async (checked) => {
                                      const updated = [...goal.key_results];
                                      updated[i] = { ...kr, done: !!checked };
                                      await supabase.from("goals").update({ key_results: updated } as any).eq("id", goal.id);
                                      fetchAll();
                                    }}
                                    className="h-3.5 w-3.5"
                                  />
                                  <span className={kr.done ? "line-through text-muted-foreground" : ""}>{kr.title || kr}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {gProjects.length > 0 && (
                            <div className="space-y-2">
                              <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Projects</h4>
                              {gProjects.map(p => (
                                <div key={p.id} className="flex items-center justify-between p-2 rounded-md bg-accent/30 cursor-pointer hover:bg-accent/50" onClick={() => openProjectDrawer(p)}>
                                  <div>
                                    <span className="text-sm font-medium">{p.title}</span>
                                    <span className="text-xs text-muted-foreground ml-2">{getName(p.owner_id)}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">{tasksForProject(p.id).filter(t=>t.status==="done").length}/{tasksForProject(p.id).length} tasks</span>
                                    <Select value={p.status} onValueChange={v => updateStatus("projects", p.id, v)}>
                                      <SelectTrigger className="w-28 h-7 text-xs" onClick={e => e.stopPropagation()}><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                        {["not_started","in_progress","done","blocked"].map(s => (
                                          <SelectItem key={s} value={s}>{statusConfig[s]?.label || s}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          {gTasks.length > 0 && (
                            <div className="space-y-2">
                              <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Direct Tasks</h4>
                              {gTasks.map(t => (
                                <div key={t.id} className="flex items-center justify-between p-2 rounded-md bg-accent/20 cursor-pointer hover:bg-accent/40" onClick={() => openTaskDrawer(t)}>
                                  <div>
                                    <span className="text-sm">{t.title}</span>
                                    <span className="text-xs text-muted-foreground ml-2">{getName(t.assigned_to)}</span>
                                  </div>
                                  <Select value={t.status} onValueChange={v => updateStatus("tasks", t.id, v)}>
                                    <SelectTrigger className="w-24 h-7 text-xs" onClick={e => e.stopPropagation()}><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      {["todo","in_progress","done"].map(s => (
                                        <SelectItem key={s} value={s}>{statusConfig[s]?.label || s}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                );
              })}
            </div>
          ))}
          {goals.length === 0 && (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No goals yet. Create your first quarterly goal to get started.</CardContent></Card>
          )}
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
            />
          )}

          {pv.view === "table" && (
            <DataTableView
              items={filteredProjects}
              type="project"
              onItemClick={openProjectDrawer}
              onStatusChange={(id, status) => updateStatus("projects", id, status)}
              getName={getName}
              statusOptions={projectStatusOptions}
              goals={goals}
            />
          )}
        </TabsContent>

        {/* Tasks tab */}
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

          {tv.view === "list" && (
            <TableView
              items={visibleTasks}
              type="task"
              onItemClick={openTaskDrawer}
              onStatusChange={(id, status) => updateStatus("tasks", id, status)}
              getName={getName}
              statusOptions={taskStatusOptions}
              projects={projects}
            />
          )}

          {tv.view === "board" && (
            <KanbanBoard
              columns={taskKanbanCols}
              items={visibleTasks}
              statusField="status"
              onItemClick={openTaskDrawer}
              onStatusChange={(id, status) => updateStatus("tasks", id, status)}
              getName={getName}
              ownerField="assigned_to"
              type="task"
            />
          )}

          {tv.view === "table" && (
            <DataTableView
              items={visibleTasks}
              type="task"
              onItemClick={openTaskDrawer}
              onStatusChange={(id, status) => updateStatus("tasks", id, status)}
              getName={getName}
              statusOptions={taskStatusOptions}
              projects={projects}
            />
          )}
        </TabsContent>

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
                          <Badge className={`text-xs ${priorityLabels[issue.priority]?.color}`}>{priorityLabels[issue.priority]?.label}</Badge>
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
                <Badge className={`text-xs ${priorityLabels[selectedIssue.priority]?.color}`}>{priorityLabels[selectedIssue.priority]?.label}</Badge>
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

      {/* Detail Drawer */}
      <DetailDrawer
        open={!!drawerItem}
        onOpenChange={o => { if (!o) setDrawerItem(null); }}
        type={drawerType}
        item={drawerItem}
        onStatusChange={v => {
          updateStatus(drawerType === "project" ? "projects" : "tasks", drawerItem.id, v);
          setDrawerItem((prev: any) => prev ? { ...prev, status: v } : null);
        }}
        getName={getName}
      />
    </div>
  );
}

// Unified create dialog — de-formed style
function CreateDialog({ title, open, onOpenChange, onSubmit, type, goals, projects, departments, profiles }: {
  title: string; open: boolean; onOpenChange: (o: boolean) => void;
  onSubmit: (data: any) => void; type: "goal" | "project" | "task";
  goals: Goal[]; projects: Project[];
  departments: { id: string; name: string }[];
  profiles: { user_id: string; full_name: string | null }[];
}) {
  const [form, setForm] = useState<Record<string, string>>({});
  const [showDesc, setShowDesc] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSubmit = () => {
    if (!form.title?.trim()) { toast({ title: "Title required", variant: "destructive" }); return; }
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
                  {profiles.map(p => <SelectItem key={p.user_id} value={p.user_id}>{p.full_name || "Unknown"}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
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
