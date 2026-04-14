import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format, addDays, addMonths, startOfTomorrow, startOfToday } from "date-fns";
import {
  ArrowLeft, Calendar, User, Tag, X, Plus, CheckSquare, Repeat, Save,
  ChevronDown, Circle, Zap, AlertTriangle, FolderOpen, Target, FileText, Link2,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import RichTextEditor from "@/components/RichTextEditor";
import ActivitySidebar from "@/components/ActivitySidebar";

const statusConfig: Record<string, { label: string; color: string }> = {
  todo: { label: "To Do", color: "bg-muted text-muted-foreground" },
  in_progress: { label: "In Progress", color: "bg-blue-100 text-blue-800" },
  done: { label: "Done", color: "bg-green-100 text-green-800" },
};

const priorityConfig: Record<string, { label: string; color: string; icon: any }> = {
  low: { label: "Low", color: "bg-green-100 text-green-800", icon: Circle },
  medium: { label: "Medium", color: "bg-yellow-100 text-yellow-800", icon: Zap },
  high: { label: "High", color: "bg-red-100 text-red-800", icon: AlertTriangle },
  urgent: { label: "Urgent", color: "bg-red-200 text-red-900", icon: AlertTriangle },
};

interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

interface RecurrenceRule {
  frequency: "daily" | "weekly" | "monthly" | "custom";
  interval: number;
  days_of_week?: number[];
  end_date?: string;
}

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [task, setTask] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<{ user_id: string; full_name: string | null }[]>([]);
  const [linkedDocs, setLinkedDocs] = useState<any[]>([]);
  const [allDocs, setAllDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [newTagInput, setNewTagInput] = useState("");
  const [newSubtask, setNewSubtask] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [subtasksOpen, setSubtasksOpen] = useState(true);
  const [linkedDocsOpen, setLinkedDocsOpen] = useState(true);

  const fetchData = useCallback(async () => {
    if (!id) return;
    const [tRes, pRes, gRes, prRes, docsRes] = await Promise.all([
      supabase.from("tasks").select("*").eq("id", id).single(),
      supabase.from("projects").select("id, title"),
      supabase.from("goals").select("id, title"),
      supabase.from("profiles").select("user_id, full_name"),
      supabase.from("documents").select("id, title"),
    ]);
    if (tRes.data) {
      const data = tRes.data;
      if (!Array.isArray(data.subtasks)) data.subtasks = [];
      setTask(data);
      setTitleDraft(data.title);
    }
    if (pRes.data) setProjects(pRes.data);
    if (gRes.data) setGoals(gRes.data);
    if (prRes.data) setProfiles(prRes.data);
    if (docsRes.data) setAllDocs(docsRes.data);

    // Fetch linked docs via entity_links
    const { data: links } = await supabase
      .from("entity_links")
      .select("*")
      .eq("source_type", "task")
      .eq("source_id", id);
    if (links) {
      const docIds = links.filter(l => l.target_type === "document").map(l => l.target_id);
      if (docIds.length > 0) {
        const { data: docs } = await supabase.from("documents").select("id, title").in("id", docIds);
        setLinkedDocs(docs || []);
      } else {
        setLinkedDocs([]);
      }
    }

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

  const recurrenceRule: RecurrenceRule | null = task?.recurrence_rule || null;

  const toggleRecurring = (checked: boolean) => {
    if (checked) {
      updateTask({ is_recurring: true, recurrence_rule: { frequency: "weekly", interval: 1 } });
    } else {
      updateTask({ is_recurring: false, recurrence_rule: null });
    }
  };

  const updateRecurrence = (updates: Partial<RecurrenceRule>) => {
    const current = recurrenceRule || { frequency: "weekly", interval: 1 };
    updateTask({ recurrence_rule: { ...current, ...updates } });
  };

  const saveAsTemplate = async () => {
    if (!task) return;
    const { error } = await supabase.from("task_templates").insert({
      title: task.title,
      description: task.description || "",
      subtasks: task.subtasks || [],
      tags: task.tags || [],
      priority: task.priority || "medium",
      assignee_id: task.assigned_to,
      recurrence_rule: task.recurrence_rule,
      created_by: user?.id,
    });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else toast({ title: "Saved as template" });
  };

  if (loading) return <div className="p-6 text-center text-muted-foreground">Loading...</div>;
  if (!task) return <div className="p-6 text-center text-muted-foreground">Task not found.</div>;

  const projectTitle = projects.find(p => p.id === task.project_id)?.title;
  const goalTitle = goals.find(g => g.id === task.goal_id)?.title;
  const doneSubtasks = subtasks.filter(st => st.done).length;

  return (
    <div className="h-full flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b shrink-0">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <Button variant="outline" size="sm" onClick={saveAsTemplate}>
          <Save className="h-4 w-4 mr-1" /> Save as Template
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
                {task.title}
              </h1>
            )}
          </div>

          {/* Compact metadata row */}
          <div className="flex items-center gap-2 flex-wrap mb-6 text-sm">
            {/* Status */}
            <Select value={task.status} onValueChange={v => { updateTask({ status: v }); logActivity("status_changed", { new_status: v }); }}>
              <SelectTrigger className="h-7 w-auto text-xs border-none shadow-none px-2 gap-1 focus:ring-0 focus-visible:ring-0 focus:ring-offset-0 [&>svg:last-child]:hidden">
                <Badge className={`${statusConfig[task.status]?.color || "bg-muted"} text-[11px] pointer-events-none`}>
                  {statusConfig[task.status]?.label || task.status}
                </Badge>
              </SelectTrigger>
              <SelectContent>
                {Object.entries(statusConfig).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>

            <span className="text-muted-foreground/30">·</span>

            {/* Priority */}
            <Select value={task.priority || "medium"} onValueChange={v => { updateTask({ priority: v }); logActivity("priority_changed", { new_priority: v }); }}>
              <SelectTrigger className="h-7 w-auto text-xs border-none shadow-none px-2 gap-1 focus:ring-0 focus-visible:ring-0 focus:ring-offset-0 [&>svg:last-child]:hidden">
                <Badge variant="outline" className={`${priorityConfig[task.priority]?.color || ""} text-[11px] pointer-events-none`}>
                  {priorityConfig[task.priority]?.label || task.priority}
                </Badge>
              </SelectTrigger>
              <SelectContent>
                {Object.entries(priorityConfig).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>

            <span className="text-muted-foreground/30">·</span>

            {/* Assignee */}
            <Select value={task.assigned_to || "none"} onValueChange={v => { updateTask({ assigned_to: v === "none" ? null : v }); logActivity("assigned", { assignee_name: getName(v === "none" ? null : v) }); }}>
              <SelectTrigger className="h-7 w-auto text-xs border-none shadow-none px-2 gap-1">
                <User className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{getName(task.assigned_to)}</span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {profiles.map(p => <SelectItem key={p.user_id} value={p.user_id}>{p.full_name || "Unknown"}</SelectItem>)}
              </SelectContent>
            </Select>

            <span className="text-muted-foreground/30">·</span>

            {/* Due date */}
            <Popover>
              <PopoverTrigger asChild>
                <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground h-7 px-2 rounded-md hover:bg-accent/50 transition-colors">
                  <Calendar className="h-3 w-3" />
                  {task.due_date ? format(new Date(task.due_date + "T00:00:00"), "MMM d, yyyy") : "No due date"}
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
                      <Button key={opt.label} variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { updateTask({ due_date: format(opt.date, "yyyy-MM-dd") }); }}>
                        {opt.label}
                      </Button>
                    ))}
                    {task.due_date && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => updateTask({ due_date: null })}>
                        Clear
                      </Button>
                    )}
                  </div>
                  <CalendarComponent
                    mode="single"
                    selected={task.due_date ? new Date(task.due_date + "T00:00:00") : undefined}
                    onSelect={(date) => { if (date) updateTask({ due_date: format(date, "yyyy-MM-dd") }); }}
                    className="p-3 pointer-events-auto"
                  />
                </div>
              </PopoverContent>
            </Popover>

            {/* Project */}
            {projectTitle && (
              <>
                <span className="text-muted-foreground/30">·</span>
                <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground" onClick={() => navigate(`/projects/${task.project_id}`)}>
                  <FolderOpen className="h-3 w-3" /> {projectTitle}
                </button>
              </>
            )}

            {/* Goal */}
            {goalTitle && (
              <>
                <span className="text-muted-foreground/30">·</span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Target className="h-3 w-3" /> {goalTitle}
                </span>
              </>
            )}

            {/* Recurring badge */}
            {task.is_recurring && (
              <>
                <span className="text-muted-foreground/30">·</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Badge variant="outline" className="text-[11px] cursor-pointer gap-1">
                      <Repeat className="h-3 w-3" /> Recurring
                    </Badge>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-3 space-y-2" align="start">
                    <Select value={recurrenceRule?.frequency || "weekly"} onValueChange={v => updateRecurrence({ frequency: v as any })}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input type="number" min={1} value={recurrenceRule?.interval || 1} onChange={e => updateRecurrence({ interval: parseInt(e.target.value) || 1 })} className="h-8 text-xs" placeholder="Interval" />
                  </PopoverContent>
                </Popover>
              </>
            )}

            {/* Tags */}
            {(task.tags || []).map((t: string) => (
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

          {/* Notes / Workspace — THE primary area */}
          <div className="mb-6">
            <RichTextEditor
              content={task.notes_content || ""}
              onChange={html => updateTask({ notes_content: html })}
              placeholder="Write notes, plans, context..."
              borderless
            />
          </div>

          {/* Subtasks — collapsible, below notes */}
          <Collapsible open={subtasksOpen} onOpenChange={setSubtasksOpen}>
            <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground w-full py-2">
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${subtasksOpen ? "" : "-rotate-90"}`} />
              <CheckSquare className="h-3.5 w-3.5" />
              Subtasks {subtasks.length > 0 && <span className="text-xs font-normal">({doneSubtasks}/{subtasks.length})</span>}
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1.5 pt-2">
              {subtasks.map(st => (
                <div key={st.id} className="flex items-center gap-3 py-1.5 px-2 rounded-md hover:bg-accent/30 group">
                  <Checkbox checked={st.done} onCheckedChange={() => toggleSubtask(st.id)} />
                  <span className={`text-sm flex-1 ${st.done ? "line-through text-muted-foreground" : ""}`}>{st.title}</span>
                  <button className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity" onClick={() => removeSubtask(st.id)}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <div className="flex gap-2 pt-1">
                <Input
                  value={newSubtask}
                  onChange={e => setNewSubtask(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addSubtask()}
                  placeholder="Add a subtask..."
                  className="text-sm h-8 border-dashed"
                />
                <Button size="sm" variant="ghost" onClick={addSubtask} disabled={!newSubtask.trim()}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Activity sidebar */}
        <ActivitySidebar
          entityType="task"
          entityId={task.id}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(c => !c)}
        />
      </div>
    </div>
  );
}
