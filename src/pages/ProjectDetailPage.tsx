import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDepartments } from "@/contexts/DepartmentsContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft, Calendar, User, FolderOpen, Plus, CheckCircle2, Circle, Clock,
  AlertTriangle, Tag, X,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import RichTextEditor from "@/components/RichTextEditor";
import CommentsSection from "@/components/CommentsSection";
import EntityActivity from "@/components/EntityActivity";

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
  const [loading, setLoading] = useState(true);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [newTagInput, setNewTagInput] = useState("");
  const [activeTab, setActiveTab] = useState("overview");

  // New task inline
  const [newTaskTitle, setNewTaskTitle] = useState("");

  const fetchData = useCallback(async () => {
    if (!id) return;
    const [pRes, tRes, gRes, prRes] = await Promise.all([
      supabase.from("projects").select("*").eq("id", id).single(),
      supabase.from("tasks").select("*").eq("project_id", id).order("created_at"),
      supabase.from("goals").select("id, title"),
      supabase.from("profiles").select("user_id, full_name"),
    ]);
    if (pRes.data) { setProject(pRes.data); setTitleDraft(pRes.data.title); }
    if (tRes.data) setTasks(tRes.data);
    if (gRes.data) setGoals(gRes.data);
    if (prRes.data) setProfiles(prRes.data);
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const getName = (uid: string | null) => {
    if (!uid) return "Unassigned";
    return profiles.find(p => p.user_id === uid)?.full_name || "Unknown";
  };

  const updateProject = async (updates: Record<string, any>) => {
    const { error } = await supabase.from("projects").update(updates).eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { setProject((p: any) => ({ ...p, ...updates })); }
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
      const newTags = [...(project.tags || []), tag];
      updateProject({ tags: newTags });
    }
    setNewTagInput("");
  };

  const removeTag = (tag: string) => {
    const newTags = (project.tags || []).filter((t: string) => t !== tag);
    updateProject({ tags: newTags });
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
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Back button */}
      <Button variant="ghost" size="sm" onClick={() => navigate("/execution")}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to Execution Hub
      </Button>

      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <FolderOpen className="h-6 w-6 text-primary mt-1" />
          <div className="flex-1">
            {editingTitle ? (
              <Input
                value={titleDraft}
                onChange={e => setTitleDraft(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={e => e.key === "Enter" && saveTitle()}
                autoFocus
                className="text-2xl font-bold h-auto py-0 px-1 border-none shadow-none focus-visible:ring-1"
              />
            ) : (
              <h1
                className="text-2xl font-bold cursor-pointer hover:bg-accent/30 rounded px-1 -mx-1"
                onClick={() => setEditingTitle(true)}
              >
                {project.title}
              </h1>
            )}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Badge className={statusConfig[project.status]?.color || "bg-muted"}>
                {statusConfig[project.status]?.label || project.status}
              </Badge>
              <Badge variant="outline" className={priorityConfig[project.priority]?.color || ""}>
                {priorityConfig[project.priority]?.label || project.priority}
              </Badge>
              {goalTitle && <Badge variant="outline">🎯 {goalTitle}</Badge>}
            </div>
          </div>
        </div>

        {/* Metadata row */}
        <div className="flex items-center gap-6 text-sm text-muted-foreground flex-wrap">
          <div className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5" /> {getName(project.owner_id)}
          </div>
          {project.due_date && (
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" /> {project.due_date}
            </div>
          )}
          <div>{doneTasks}/{tasks.length} tasks complete</div>
        </div>

        <Progress value={progress} className="h-2" />
      </div>

      {/* Meta fields */}
      <Card>
        <CardContent className="py-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground">Status</label>
              <Select value={project.status} onValueChange={v => { updateProject({ status: v }); logActivity("status_changed", { new_status: v }); }}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(statusConfig).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Priority</label>
              <Select value={project.priority || "medium"} onValueChange={v => { updateProject({ priority: v }); logActivity("priority_changed", { new_priority: v }); }}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(priorityConfig).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Due Date</label>
              <Input
                type="date"
                value={project.due_date || ""}
                onChange={e => updateProject({ due_date: e.target.value || null })}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Goal</label>
              <Select value={project.goal_id || "none"} onValueChange={v => updateProject({ goal_id: v === "none" ? null : v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {goals.map(g => <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs text-muted-foreground">Description</label>
            <Textarea
              value={project.description || ""}
              onChange={e => updateProject({ description: e.target.value })}
              placeholder="Add a description..."
              rows={2}
              className="text-sm mt-1"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="text-xs text-muted-foreground flex items-center gap-1"><Tag className="h-3 w-3" /> Tags</label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {(project.tags || []).map((t: string) => (
                <Badge key={t} variant="secondary" className="text-xs gap-1">
                  {t}
                  <button onClick={() => removeTag(t)} className="hover:text-destructive"><X className="h-3 w-3" /></button>
                </Badge>
              ))}
              <Input
                value={newTagInput}
                onChange={e => setNewTagInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addTag())}
                placeholder="Add tag..."
                className="h-6 w-24 text-xs border-dashed"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Tasks</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="comments">Comments & Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-3 mt-4">
          {/* Inline add task */}
          <div className="flex gap-2">
            <Input
              value={newTaskTitle}
              onChange={e => setNewTaskTitle(e.target.value)}
              onKeyDown={e => e.key === "Enter" && createTask()}
              placeholder="Add a task..."
              className="text-sm"
            />
            <Button size="sm" onClick={createTask} disabled={!newTaskTitle.trim()}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {tasks.map(t => (
            <Card key={t.id} className="cursor-pointer hover:bg-accent/20 transition-colors" onClick={() => navigate(`/tasks/${t.id}`)}>
              <CardContent className="py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
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
              </CardContent>
            </Card>
          ))}
          {tasks.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No tasks yet. Add one above.</p>
          )}
        </TabsContent>

        <TabsContent value="notes" className="mt-4">
          <Card>
            <CardContent className="py-4">
              <RichTextEditor
                content={project.notes_content || ""}
                onChange={html => updateProject({ notes_content: html })}
                placeholder="Write project notes, plans, meeting notes..."
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="comments" className="mt-4 space-y-6">
          <Card>
            <CardContent className="py-4">
              <CommentsSection entityType="project" entityId={project.id} />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <EntityActivity entityType="project" entityId={project.id} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
