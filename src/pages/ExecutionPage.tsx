import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDepartments } from "@/contexts/DepartmentsContext";
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
import { Target, Plus, ChevronDown, Calendar, CheckCircle2, Circle, Clock, AlertTriangle, XCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type Goal = {
  id: string; title: string; description: string; quarter: string; year: number;
  status: string; owner_id: string | null; department_id: string | null;
  created_by: string | null; progress: number; created_at: string; updated_at: string;
};
type Project = {
  id: string; title: string; description: string; goal_id: string | null;
  status: string; owner_id: string | null; department_id: string | null;
  due_date: string | null; created_by: string | null; created_at: string; updated_at: string;
};
type Task = {
  id: string; title: string; description: string; project_id: string | null;
  goal_id: string | null; status: string; assigned_to: string | null;
  due_date: string | null; created_by: string | null; created_at: string; updated_at: string;
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

const currentQuarter = () => {
  const m = new Date().getMonth();
  return `Q${Math.floor(m / 3) + 1}`;
};
const currentYear = () => new Date().getFullYear();

export default function ExecutionPage() {
  const { user, isAdmin } = useAuth();
  const { departments } = useDepartments();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [profiles, setProfiles] = useState<{ user_id: string; full_name: string | null }[]>([]);
  const [tab, setTab] = useState("goals");
  const [createGoalOpen, setCreateGoalOpen] = useState(false);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);

  const fetchAll = useCallback(async () => {
    const [g, p, t, pr] = await Promise.all([
      supabase.from("goals").select("*").order("year", { ascending: false }).order("quarter"),
      supabase.from("projects").select("*").order("created_at", { ascending: false }),
      supabase.from("tasks").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("user_id, full_name"),
    ]);
    if (g.data) setGoals(g.data);
    if (p.data) setProjects(p.data);
    if (t.data) setTasks(t.data);
    if (pr.data) setProfiles(pr.data);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const getName = (uid: string | null) => {
    if (!uid) return "Unassigned";
    return profiles.find(p => p.user_id === uid)?.full_name || "Unknown";
  };

  const goalsByQuarter = goals.reduce<Record<string, Goal[]>>((acc, g) => {
    const key = `${g.year} ${g.quarter}`;
    (acc[key] = acc[key] || []).push(g);
    return acc;
  }, {});

  const projectsForGoal = (goalId: string) => projects.filter(p => p.goal_id === goalId);
  const tasksForProject = (projectId: string) => tasks.filter(t => t.project_id === projectId);
  const tasksForGoal = (goalId: string) => tasks.filter(t => t.goal_id === goalId && !t.project_id);

  // Quick create handlers
  const createGoal = async (data: { title: string; quarter: string; year: number; description: string; department_id: string }) => {
    const { error } = await supabase.from("goals").insert({
      title: data.title, quarter: data.quarter, year: data.year,
      description: data.description, department_id: data.department_id || null,
      owner_id: user?.id, created_by: user?.id,
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
    else fetchAll();
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const cfg = statusConfig[status] || { label: status, color: "bg-muted text-muted-foreground", icon: Circle };
    return <Badge variant="secondary" className={`${cfg.color} text-xs`}>{cfg.label}</Badge>;
  };

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
              <CreateDialog title="New Task" open={createTaskOpen} onOpenChange={setCreateTaskOpen}
                onSubmit={createTask} type="task" goals={goals} projects={projects}
                departments={departments} profiles={profiles} />
            )}
          </div>
        </div>

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
                          {gProjects.length > 0 && (
                            <div className="space-y-2">
                              <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Projects</h4>
                              {gProjects.map(p => (
                                <div key={p.id} className="flex items-center justify-between p-2 rounded-md bg-accent/30">
                                  <div>
                                    <span className="text-sm font-medium">{p.title}</span>
                                    <span className="text-xs text-muted-foreground ml-2">{getName(p.owner_id)}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">{tasksForProject(p.id).filter(t=>t.status==="done").length}/{tasksForProject(p.id).length} tasks</span>
                                    <Select value={p.status} onValueChange={v => updateStatus("projects", p.id, v)}>
                                      <SelectTrigger className="w-28 h-7 text-xs"><SelectValue /></SelectTrigger>
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
                                <div key={t.id} className="flex items-center justify-between p-2 rounded-md bg-accent/20">
                                  <div>
                                    <span className="text-sm">{t.title}</span>
                                    <span className="text-xs text-muted-foreground ml-2">{getName(t.assigned_to)}</span>
                                  </div>
                                  <Select value={t.status} onValueChange={v => updateStatus("tasks", t.id, v)}>
                                    <SelectTrigger className="w-24 h-7 text-xs"><SelectValue /></SelectTrigger>
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

        <TabsContent value="projects" className="space-y-3">
          {projects.map(p => {
            const pTasks = tasksForProject(p.id);
            const goalTitle = goals.find(g => g.id === p.goal_id)?.title;
            return (
              <Card key={p.id}>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">{p.title}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        {goalTitle && <Badge variant="outline" className="text-xs">🎯 {goalTitle}</Badge>}
                        <span className="text-xs text-muted-foreground">{getName(p.owner_id)}</span>
                        <span className="text-xs text-muted-foreground">{pTasks.filter(t=>t.status==="done").length}/{pTasks.length} tasks</span>
                      </div>
                    </div>
                    <Select value={p.status} onValueChange={v => updateStatus("projects", p.id, v)}>
                      <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["not_started","in_progress","done","blocked"].map(s => (
                          <SelectItem key={s} value={s}>{statusConfig[s]?.label || s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {projects.length === 0 && (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No projects yet.</CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="tasks" className="space-y-3">
          {(isAdmin ? tasks : tasks.filter(t => t.assigned_to === user?.id)).map(t => {
            const projectTitle = projects.find(p => p.id === t.project_id)?.title;
            const goalTitle = goals.find(g => g.id === t.goal_id)?.title;
            return (
              <Card key={t.id}>
                <CardContent className="py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-sm">{t.title}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        {goalTitle && <Badge variant="outline" className="text-xs">🎯 {goalTitle}</Badge>}
                        {projectTitle && <Badge variant="outline" className="text-xs">📁 {projectTitle}</Badge>}
                        {t.due_date && <span className="text-xs text-muted-foreground">Due {t.due_date}</span>}
                        <span className="text-xs text-muted-foreground">{getName(t.assigned_to)}</span>
                      </div>
                    </div>
                    <Select value={t.status} onValueChange={v => updateStatus("tasks", t.id, v)}>
                      <SelectTrigger className="w-24 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["todo","in_progress","done"].map(s => (
                          <SelectItem key={s} value={s}>{statusConfig[s]?.label || s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {tasks.filter(t => isAdmin || t.assigned_to === user?.id).length === 0 && (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No tasks assigned to you.</CardContent></Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Unified create dialog
function CreateDialog({ title, open, onOpenChange, onSubmit, type, goals, projects, departments, profiles }: {
  title: string; open: boolean; onOpenChange: (o: boolean) => void;
  onSubmit: (data: any) => void; type: "goal" | "project" | "task";
  goals: Goal[]; projects: Project[];
  departments: { id: string; name: string }[];
  profiles: { user_id: string; full_name: string | null }[];
}) {
  const [form, setForm] = useState<Record<string, string>>({});

  const handleSubmit = () => {
    if (!form.title?.trim()) { toast({ title: "Title required", variant: "destructive" }); return; }
    onSubmit({
      ...form,
      year: form.year ? parseInt(form.year) : currentYear(),
      quarter: form.quarter || currentQuarter(),
    });
    setForm({});
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4 mr-1" /> {title}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Title</Label>
            <Input value={form.title || ""} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={form.description || ""} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} />
          </div>
          {type === "goal" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Quarter</Label>
                <Select value={form.quarter || currentQuarter()} onValueChange={v => setForm(p => ({ ...p, quarter: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Q1","Q2","Q3","Q4"].map(q => <SelectItem key={q} value={q}>{q}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Year</Label>
                <Input type="number" value={form.year || currentYear()} onChange={e => setForm(p => ({ ...p, year: e.target.value }))} />
              </div>
            </div>
          )}
          {type === "project" && (
            <div>
              <Label>Link to Goal</Label>
              <Select value={form.goal_id || ""} onValueChange={v => setForm(p => ({ ...p, goal_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>
                  {goals.map(g => <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {type === "task" && (
            <>
              <div>
                <Label>Link to Project</Label>
                <Select value={form.project_id || ""} onValueChange={v => setForm(p => ({ ...p, project_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                  <SelectContent>
                    {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Assign To</Label>
                <Select value={form.assigned_to || ""} onValueChange={v => setForm(p => ({ ...p, assigned_to: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select person" /></SelectTrigger>
                  <SelectContent>
                    {profiles.map(p => <SelectItem key={p.user_id} value={p.user_id}>{p.full_name || "Unknown"}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          {(type === "goal" || type === "project") && departments.length > 0 && (
            <div>
              <Label>Department</Label>
              <Select value={form.department_id || ""} onValueChange={v => setForm(p => ({ ...p, department_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>
                  {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <Button onClick={handleSubmit} className="w-full">Create</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
