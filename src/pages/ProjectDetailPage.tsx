import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDepartments } from "@/contexts/DepartmentsContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format, addDays, addMonths, startOfTomorrow, startOfToday } from "date-fns";
import {
  ArrowLeft, Calendar, User, FolderOpen, Plus, CheckCircle2, Circle, Clock,
  Tag, X, ChevronDown, Target, Zap, AlertTriangle, FileText,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import RichTextEditor from "@/components/RichTextEditor";
import ActivitySidebar from "@/components/ActivitySidebar";

const statusConfig: Record<string, { label: string; color: string }> = {
  not_started: { label: "Not Started", color: "bg-muted text-muted-foreground" },
  in_progress: { label: "In Progress", color: "bg-blue-100 text-blue-800" },
  done: { label: "Done", color: "bg-green-100 text-green-800" },
  blocked: { label: "Blocked", color: "bg-red-100 text-red-800" },
};

const priorityConfig: Record<string, { label: string; color: string }> = {
  low: { label: "Low", color: "bg-green-100 text-green-800" },
  medium: { label: "Medium", color: "bg-yellow-100 text-yellow-800" },
  high: { label: "High", color: "bg-red-100 text-red-800" },
  urgent: { label: "Urgent", color: "bg-red-200 text-red-900" },
};

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { departments } = useDepartments();

  const [project, setProject] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<{ user_id: string; full_name: string | null }[]>([]);
  const [linkedDocs, setLinkedDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [newTagInput, setNewTagInput] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [tasksOpen, setTasksOpen] = useState(true);
  const [docsOpen, setDocsOpen] = useState(true);

  const fetchData = useCallback(async () => {
    if (!id) return;
    const [pRes, tRes, gRes, prRes, dRes] = await Promise.all([
      supabase.from("projects").select("*").eq("id", id).single(),
      supabase.from("tasks").select("*").eq("project_id", id).order("created_at"),
      supabase.from("goals").select("id, title"),
      supabase.from("profiles").select("user_id, full_name"),
      supabase.from("documents").select("id, title, updated_at").eq("project_id", id).order("updated_at", { ascending: false }),
    ]);
    if (pRes.data) { setProject(pRes.data); setTitleDraft(pRes.data.title); }
    if (tRes.data) setTasks(tRes.data);
    if (gRes.data) setGoals(gRes.data);
    if (prRes.data) setProfiles(prRes.data);
    if (dRes.data) setLinkedDocs(dRes.data);
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const getName = (uid: string | null) => {
    if (!uid) return "Unassigned";
    return profiles.find(p => p.user_id === uid)?.full_name || "Unknown";
  };

  const updateProject = async (updates: Record<string, any>) => {
    const { error } = await supabase.from("projects").update(updates as any).eq("id", id!);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else setProject((p: any) => ({ ...p, ...updates }));
  };

  const logActivity = async (action: string, metadata: Record<string, any> = {}) => {
    await supabase.from("entity_activity").insert({
      entity_type: "project", entity_id: id, actor_id: user?.id, action, metadata,
    });
  };

  const saveTitle = () => {
    if (titleDraft.trim() && titleDraft !== project.title) {
      updateProject({ title: titleDraft.trim() });
      logActivity("title_changed", { old: project.title, new: titleDraft.trim() });
    }
    setEditingTitle(false);
  };

  const addTag = () => {
    const tag = newTagInput.trim().toLowerCase();
    if (tag && !project.tags?.includes(tag)) {
      updateProject({ tags: [...(project.tags || []), tag] });
    }
    setNewTagInput("");
  };

  const removeTag = (tag: string) => {
    updateProject({ tags: (project.tags || []).filter((t: string) => t !== tag) });
  };

  const createTask = async () => {
    if (!newTaskTitle.trim()) return;
    const { error } = await supabase.from("tasks").insert({
      title: newTaskTitle.trim(), project_id: id, created_by: user?.id, assigned_to: user?.id,
    });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { setNewTaskTitle(""); fetchData(); }
  };

  const updateTaskStatus = async (taskId: string, status: string) => {
    await supabase.from("tasks").update({ status }).eq("id", taskId);
    fetchData();
  };

  if (loading) return <div className="p-6 text-center text-muted-foreground">Loading...</div>;
  if (!project) return <div className="p-6 text-center text-muted-foreground">Project not found.</div>;

  const doneTasks = tasks.filter(t => t.status === "done").length;
  const progress = tasks.length > 0 ? Math.round((doneTasks / tasks.length) * 100) : 0;
  const goalTitle = goals.find(g => g.id === project.goal_id)?.title;

  return (
    <div className="h-full flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b shrink-0">
        <Button variant="ghost" size="sm" onClick={() => navigate("/execution")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Execution Hub
        </Button>
      </div>

      {/* Two-column layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Main workspace */}
        <div className="flex-1 min-w-0 overflow-y-auto px-6 py-6 max-w-4xl">
          {/* Title */}
          <div className="mb-4">
            {editingTitle ? (
              <Input
                value={titleDraft}
                onChange={e => setTitleDraft(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={e => e.key === "Enter" && saveTitle()}
                autoFocus
                className="text-2xl font-bold h-auto py-1 px-2 border-none shadow-none focus-visible:ring-1"
              />
            ) : (
              <h1
                className="text-2xl font-bold cursor-pointer hover:bg-accent/30 rounded px-2 -mx-2 py-1"
                onClick={() => setEditingTitle(true)}
              >
                {project.title}
              </h1>
            )}
          </div>

          {/* Compact metadata row */}
          <div className="flex items-center gap-2 flex-wrap mb-2 text-sm">
            {/* Status */}
            <Select value={project.status} onValueChange={v => { updateProject({ status: v }); logActivity("status_changed", { new_status: v }); }}>
              <SelectTrigger className="h-7 w-auto text-xs border-none shadow-none px-2 gap-1 focus:ring-0 focus-visible:ring-0 focus:ring-offset-0 [&>svg:last-child]:hidden">
                <Badge className={`${statusConfig[project.status]?.color || "bg-muted"} text-[11px] pointer-events-none`}>
                  {statusConfig[project.status]?.label || project.status}
                </Badge>
              </SelectTrigger>
              <SelectContent>
                {Object.entries(statusConfig).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>

            <span className="text-muted-foreground/30">·</span>

            {/* Priority */}
            <Select value={project.priority || "medium"} onValueChange={v => { updateProject({ priority: v }); logActivity("priority_changed", { new_priority: v }); }}>
              <SelectTrigger className="h-7 w-auto text-xs border-none shadow-none px-2 gap-1 focus:ring-0 focus-visible:ring-0 focus:ring-offset-0 [&>svg:last-child]:hidden">
                <Badge variant="outline" className={`${priorityConfig[project.priority]?.color || ""} text-[11px] pointer-events-none`}>
                  {priorityConfig[project.priority]?.label || project.priority}
                </Badge>
              </SelectTrigger>
              <SelectContent>
                {Object.entries(priorityConfig).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>

            <span className="text-muted-foreground/30">·</span>

            {/* Owner */}
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <User className="h-3 w-3" /> {getName(project.owner_id)}
            </span>

            <span className="text-muted-foreground/30">·</span>

            {/* Due date */}
            <Popover>
              <PopoverTrigger asChild>
                <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground h-7 px-2 rounded-md hover:bg-accent/50 transition-colors">
                  <Calendar className="h-3 w-3" />
                  {project.due_date ? format(new Date(project.due_date + "T00:00:00"), "MMM d, yyyy") : "No due date"}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <div className="flex flex-col">
                  <div className="flex flex-wrap gap-1 p-2 border-b">
                    {[
                      { label: "Today", date: startOfToday() },
                      { label: "Tomorrow", date: startOfTomorrow() },
                      { label: "Next Week", date: addDays(startOfToday(), 7) },
                      { label: "Next Month", date: addMonths(startOfToday(), 1) },
                    ].map(opt => (
                      <Button key={opt.label} variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { updateProject({ due_date: format(opt.date, "yyyy-MM-dd") }); }}>
                        {opt.label}
                      </Button>
                    ))}
                    {project.due_date && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => updateProject({ due_date: null })}>
                        Clear
                      </Button>
                    )}
                  </div>
                  <CalendarComponent
                    mode="single"
                    selected={project.due_date ? new Date(project.due_date + "T00:00:00") : undefined}
                    onSelect={(date) => { if (date) updateProject({ due_date: format(date, "yyyy-MM-dd") }); }}
                    className="p-3 pointer-events-auto"
                  />
                </div>
              </PopoverContent>
            </Popover>

            {/* Goal */}
            {goalTitle && (
              <>
                <span className="text-muted-foreground/30">·</span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Target className="h-3 w-3" /> {goalTitle}
                </span>
              </>
            )}

            {/* Tags */}
            {(project.tags || []).map((t: string) => (
              <Badge key={t} variant="secondary" className="text-[11px] gap-1">
                {t}
                <button onClick={() => removeTag(t)} className="hover:text-destructive"><X className="h-2.5 w-2.5" /></button>
              </Badge>
            ))}
            <Input
              value={newTagInput}
              onChange={e => setNewTagInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addTag())}
              placeholder="+ tag"
              className="h-6 w-16 text-[11px] border-none shadow-none bg-transparent placeholder:text-muted-foreground/40 px-1"
            />
          </div>

          {/* Progress bar */}
          {tasks.length > 0 && (
            <div className="flex items-center gap-3 mb-6">
              <Progress value={progress} className="h-1.5 flex-1" />
              <span className="text-xs text-muted-foreground">{doneTasks}/{tasks.length}</span>
            </div>
          )}

          {/* Notes / Workspace — THE primary area */}
          <div className="mb-6">
            <RichTextEditor
              content={project.notes_content || ""}
              onChange={html => updateProject({ notes_content: html })}
              placeholder="Write project notes, plans, meeting notes..."
              borderless
            />
          </div>

          {/* Tasks — collapsible, below notes */}
          <Collapsible open={tasksOpen} onOpenChange={setTasksOpen}>
            <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground w-full py-2">
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${tasksOpen ? "" : "-rotate-90"}`} />
              <FolderOpen className="h-3.5 w-3.5" />
              Tasks {tasks.length > 0 && <span className="text-xs font-normal">({doneTasks}/{tasks.length})</span>}
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1.5 pt-2">
              {tasks.map(t => (
                <div
                  key={t.id}
                  className="flex items-center justify-between py-2 px-2 rounded-md hover:bg-accent/30 cursor-pointer group"
                  onClick={() => navigate(`/tasks/${t.id}`)}
                >
                  <div className="flex items-center gap-2.5">
                    {t.status === "done" ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : t.status === "in_progress" ? (
                      <Clock className="h-4 w-4 text-blue-600" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className={`text-sm ${t.status === "done" ? "line-through text-muted-foreground" : ""}`}>{t.title}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{getName(t.assigned_to)}</span>
                    <Select value={t.status} onValueChange={v => updateTaskStatus(t.id, v)}>
                      <SelectTrigger className="w-24 h-7 text-xs" onClick={e => e.stopPropagation()}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["todo", "in_progress", "done"].map(s => (
                          <SelectItem key={s} value={s}>{s === "todo" ? "To Do" : s === "in_progress" ? "In Progress" : "Done"}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
              <div className="flex gap-2 pt-1">
                <Input
                  value={newTaskTitle}
                  onChange={e => setNewTaskTitle(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && createTask()}
                  placeholder="Add a task..."
                  className="text-sm h-8 border-dashed"
                />
                <Button size="sm" variant="ghost" onClick={createTask} disabled={!newTaskTitle.trim()}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {tasks.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No tasks yet.</p>
              )}
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Activity sidebar */}
        <ActivitySidebar
          entityType="project"
          entityId={project.id}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(c => !c)}
        />
      </div>
    </div>
  );
}
