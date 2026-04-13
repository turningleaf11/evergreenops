import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowLeft, Calendar, User, ListChecks, Tag, X, Plus, CheckSquare,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import RichTextEditor from "@/components/RichTextEditor";
import CommentsSection from "@/components/CommentsSection";
import EntityActivity from "@/components/EntityActivity";

const statusConfig: Record<string, { label: string; color: string }> = {
  todo: { label: "To Do", color: "bg-muted text-muted-foreground" },
  in_progress: { label: "In Progress", color: "bg-blue-100 text-blue-800" },
  done: { label: "Done", color: "bg-green-100 text-green-800" },
};

const priorityConfig: Record<string, { label: string; color: string }> = {
  low: { label: "Low", color: "bg-green-100 text-green-800" },
  medium: { label: "Medium", color: "bg-yellow-100 text-yellow-800" },
  high: { label: "High", color: "bg-red-100 text-red-800" },
  urgent: { label: "Urgent", color: "bg-red-200 text-red-900" },
};

interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [task, setTask] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<{ user_id: string; full_name: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [newTagInput, setNewTagInput] = useState("");
  const [newSubtask, setNewSubtask] = useState("");
  const [activeTab, setActiveTab] = useState("details");

  const fetchData = useCallback(async () => {
    if (!id) return;
    const [tRes, pRes, gRes, prRes] = await Promise.all([
      supabase.from("tasks").select("*").eq("id", id).single(),
      supabase.from("projects").select("id, title"),
      supabase.from("goals").select("id, title"),
      supabase.from("profiles").select("user_id, full_name"),
    ]);
    if (tRes.data) {
      // Ensure subtasks is always an array
      const data = tRes.data;
      if (!Array.isArray(data.subtasks)) data.subtasks = [];
      setTask(data);
      setTitleDraft(data.title);
    }
    if (pRes.data) setProjects(pRes.data);
    if (gRes.data) setGoals(gRes.data);
    if (prRes.data) setProfiles(prRes.data);
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const getName = (uid: string | null) => {
    if (!uid) return "Unassigned";
    return profiles.find(p => p.user_id === uid)?.full_name || "Unknown";
  };

  const updateTask = async (updates: Record<string, any>) => {
    const { error } = await supabase.from("tasks").update(updates as any).eq("id", id!);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else setTask((t: any) => ({ ...t, ...updates }));
  };

  const logActivity = async (action: string, metadata: Record<string, any> = {}) => {
    await supabase.from("entity_activity").insert({
      entity_type: "task", entity_id: id, actor_id: user?.id, action, metadata,
    });
  };

  const saveTitle = () => {
    if (titleDraft.trim() && titleDraft !== task.title) {
      updateTask({ title: titleDraft.trim() });
      logActivity("title_changed", { old: task.title, new: titleDraft.trim() });
    }
    setEditingTitle(false);
  };

  const addTag = () => {
    const tag = newTagInput.trim().toLowerCase();
    if (tag && !task.tags?.includes(tag)) {
      updateTask({ tags: [...(task.tags || []), tag] });
    }
    setNewTagInput("");
  };

  const removeTag = (tag: string) => {
    updateTask({ tags: (task.tags || []).filter((t: string) => t !== tag) });
  };

  // Subtask management
  const subtasks: Subtask[] = task?.subtasks || [];

  const addSubtask = () => {
    if (!newSubtask.trim()) return;
    const updated = [...subtasks, { id: crypto.randomUUID(), title: newSubtask.trim(), done: false }];
    updateTask({ subtasks: updated });
    setNewSubtask("");
  };

  const toggleSubtask = (stId: string) => {
    const updated = subtasks.map(st => st.id === stId ? { ...st, done: !st.done } : st);
    updateTask({ subtasks: updated });
  };

  const removeSubtask = (stId: string) => {
    updateTask({ subtasks: subtasks.filter(st => st.id !== stId) });
  };

  if (loading) return <div className="p-6 text-center text-muted-foreground">Loading...</div>;
  if (!task) return <div className="p-6 text-center text-muted-foreground">Task not found.</div>;

  const projectTitle = projects.find(p => p.id === task.project_id)?.title;
  const goalTitle = goals.find(g => g.id === task.goal_id)?.title;
  const doneSubtasks = subtasks.filter(st => st.done).length;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Back
      </Button>

      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <ListChecks className="h-6 w-6 text-primary mt-1" />
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
                {task.title}
              </h1>
            )}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Badge className={statusConfig[task.status]?.color || "bg-muted"}>
                {statusConfig[task.status]?.label || task.status}
              </Badge>
              <Badge variant="outline" className={priorityConfig[task.priority]?.color || ""}>
                {priorityConfig[task.priority]?.label || task.priority}
              </Badge>
              {projectTitle && (
                <Badge variant="outline" className="cursor-pointer" onClick={() => navigate(`/projects/${task.project_id}`)}>
                  📁 {projectTitle}
                </Badge>
              )}
              {goalTitle && <Badge variant="outline">🎯 {goalTitle}</Badge>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6 text-sm text-muted-foreground flex-wrap">
          <div className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5" /> {getName(task.assigned_to)}
          </div>
          {task.due_date && (
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" /> {task.due_date}
            </div>
          )}
          {subtasks.length > 0 && (
            <div className="flex items-center gap-1.5">
              <CheckSquare className="h-3.5 w-3.5" /> {doneSubtasks}/{subtasks.length} subtasks
            </div>
          )}
        </div>
      </div>

      {/* Meta fields */}
      <Card>
        <CardContent className="py-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground">Status</label>
              <Select value={task.status} onValueChange={v => { updateTask({ status: v }); logActivity("status_changed", { new_status: v }); }}>
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
              <Select value={task.priority || "medium"} onValueChange={v => { updateTask({ priority: v }); logActivity("priority_changed", { new_priority: v }); }}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(priorityConfig).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Assignee</label>
              <Select value={task.assigned_to || "none"} onValueChange={v => { updateTask({ assigned_to: v === "none" ? null : v }); logActivity("assigned", { assignee_name: getName(v === "none" ? null : v) }); }}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {profiles.map(p => <SelectItem key={p.user_id} value={p.user_id}>{p.full_name || "Unknown"}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Due Date</label>
              <Input
                type="date"
                value={task.due_date || ""}
                onChange={e => updateTask({ due_date: e.target.value || null })}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Project</label>
              <Select value={task.project_id || "none"} onValueChange={v => updateTask({ project_id: v === "none" ? null : v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Goal</label>
              <Select value={task.goal_id || "none"} onValueChange={v => updateTask({ goal_id: v === "none" ? null : v })}>
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
              value={task.description || ""}
              onChange={e => updateTask({ description: e.target.value })}
              placeholder="Add a description..."
              rows={2}
              className="text-sm mt-1"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="text-xs text-muted-foreground flex items-center gap-1"><Tag className="h-3 w-3" /> Tags</label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {(task.tags || []).map((t: string) => (
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
          <TabsTrigger value="details">Subtasks</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="comments">Comments & Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-4 space-y-3">
          {/* Add subtask */}
          <div className="flex gap-2">
            <Input
              value={newSubtask}
              onChange={e => setNewSubtask(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addSubtask()}
              placeholder="Add a subtask..."
              className="text-sm"
            />
            <Button size="sm" onClick={addSubtask} disabled={!newSubtask.trim()}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {subtasks.map(st => (
            <div key={st.id} className="flex items-center gap-3 p-2 rounded-md bg-accent/20 group">
              <Checkbox
                checked={st.done}
                onCheckedChange={() => toggleSubtask(st.id)}
              />
              <span className={`text-sm flex-1 ${st.done ? "line-through text-muted-foreground" : ""}`}>{st.title}</span>
              <button
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                onClick={() => removeSubtask(st.id)}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {subtasks.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No subtasks yet.</p>
          )}
        </TabsContent>

        <TabsContent value="notes" className="mt-4">
          <Card>
            <CardContent className="py-4">
              <RichTextEditor
                content={task.notes_content || ""}
                onChange={html => updateTask({ notes_content: html })}
                placeholder="Write task notes, context, checklists..."
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="comments" className="mt-4 space-y-6">
          <Card>
            <CardContent className="py-4">
              <CommentsSection entityType="task" entityId={task.id} />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <EntityActivity entityType="task" entityId={task.id} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
