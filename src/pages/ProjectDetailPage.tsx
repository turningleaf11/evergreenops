import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format, addDays, addMonths, startOfTomorrow, startOfToday } from "date-fns";
import {
  ArrowLeft, Calendar, Users, X, Target, MessageSquare, Check, Crown,
  LayoutDashboard, CheckSquare, PenLine, FolderOpen, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import {
  StatusBadge,
  PROJECT_STATUS_VARIANT, PROJECT_STATUS_LABEL,
  PRIORITY_VARIANT, PRIORITY_LABEL,
} from "@/components/shared/StatusBadge";
import ProjectOverviewTab from "@/components/execution/ProjectOverviewTab";
import ProjectTasksTab from "@/components/execution/ProjectTasksTab";
import ProjectWhiteboardsTab from "@/components/execution/ProjectWhiteboardsTab";
import ProjectFilesTab from "@/components/execution/ProjectFilesTab";
import ProjectAiTab from "@/components/execution/ProjectAiTab";
import ProjectChatRail from "@/components/execution/ProjectChatRail";
import GoalPeek from "@/components/execution/GoalPeek";

const projectStatusOptions = [
  { value: "not_started", label: "Not Started" },
  { value: "in_progress", label: "In Progress" },
  { value: "done", label: "Done" },
  { value: "blocked", label: "Blocked" },
];

const priorityOptions = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [project, setProject] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<{ user_id: string; full_name: string | null }[]>([]);
  const [linkedDocs, setLinkedDocs] = useState<any[]>([]);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [newTagInput, setNewTagInput] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [peekGoalId, setPeekGoalId] = useState<string | null>(null);

  const tabKey = id ? `project-tab-${id}` : "project-tab";
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (typeof window === "undefined") return "overview";
    return localStorage.getItem(tabKey) || "overview";
  });

  useEffect(() => {
    if (id) localStorage.setItem(tabKey, activeTab);
  }, [activeTab, tabKey, id]);

  const fetchData = useCallback(async () => {
    if (!id) return;
    const [pRes, tRes, gRes, prRes, dRes, aRes] = await Promise.all([
      supabase.from("projects").select("*").eq("id", id).single(),
      supabase.from("tasks").select("*").eq("project_id", id).order("created_at"),
      supabase.from("goals").select("id, title"),
      supabase.from("profiles").select("user_id, full_name"),
      supabase.from("documents").select("id, title, updated_at, content").eq("project_id", id).order("updated_at", { ascending: false }),
      supabase.from("project_attachments").select("*").eq("project_id", id).order("created_at", { ascending: false }),
    ]);
    if (pRes.data) { setProject(pRes.data); setTitleDraft(pRes.data.title); }
    if (tRes.data) setTasks(tRes.data);
    if (gRes.data) setGoals(gRes.data);
    if (prRes.data) setProfiles(prRes.data);
    if (dRes.data) setLinkedDocs(dRes.data);
    if (aRes.data) setAttachments(aRes.data);
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const getName = (uid: string | null) =>
    !uid ? "Unassigned" : profiles.find(p => p.user_id === uid)?.full_name || "Unknown";

  const updateProject = async (updates: Record<string, any>) => {
    const { error } = await supabase.from("projects").update(updates as any).eq("id", id!);
    if (error) toast.error(error.message);
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

  const removeTag = (tag: string) =>
    updateProject({ tags: (project.tags || []).filter((t: string) => t !== tag) });

  const createTask = async (title: string) => {
    const { error } = await supabase.from("tasks").insert({
      title, project_id: id, created_by: user?.id, assigned_to: user?.id,
    });
    if (error) toast.error(error.message);
    else fetchData();
  };

  const updateTaskStatus = async (taskId: string, status: string) => {
    await supabase.from("tasks").update({ status }).eq("id", taskId);
    fetchData();
  };

  if (loading) return <div className="p-6 text-center text-muted-foreground">Loading...</div>;
  if (!project) return <div className="p-6 text-center text-muted-foreground">Project not found.</div>;

  const goalTitle = goals.find(g => g.id === project.goal_id)?.title;

  return (
    <div className="h-full flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b shrink-0">
        <Button variant="ghost" size="sm" onClick={() => navigate("/execution?tab=projects")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Projects
        </Button>
        <Button
          variant={chatOpen ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setChatOpen(o => !o)}
          className="gap-1.5"
        >
          <MessageSquare className="h-4 w-4" />
          Comments
        </Button>
      </div>

      {/* Scroll container */}
      <div className={`flex-1 overflow-y-auto transition-[padding] duration-200 ${chatOpen ? "xl:pr-[360px]" : ""}`}>
        <div className="px-6 py-6 max-w-[1500px] mx-auto">
          {/* Header: title + meta */}
          <div className="mb-2 flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-muted-foreground" />
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
                className="text-2xl font-bold cursor-pointer hover:bg-accent/30 rounded px-2 -mx-1 py-1"
                onClick={() => setEditingTitle(true)}
              >
                {project.title}
              </h1>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap mb-6 text-sm">
            <Select value={project.status} onValueChange={v => { updateProject({ status: v }); logActivity("status_changed", { new_status: v }); }}>
              <SelectTrigger className="h-auto border-none shadow-none p-0 gap-1 focus:ring-0 w-auto [&>svg:last-child]:hidden">
                <StatusBadge
                  label={PROJECT_STATUS_LABEL[project.status] ?? project.status}
                  variant={PROJECT_STATUS_VARIANT[project.status] ?? "default"}
                  dot
                />
              </SelectTrigger>
              <SelectContent>
                {projectStatusOptions.map(s => (
                  <SelectItem key={s.value} value={s.value}>
                    <span className="flex items-center gap-2">
                      <StatusBadge label={s.label} variant={PROJECT_STATUS_VARIANT[s.value] ?? "default"} dot />
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <span className="text-muted-foreground/30">·</span>

            <Select value={project.priority || "medium"} onValueChange={v => { updateProject({ priority: v }); logActivity("priority_changed", { new_priority: v }); }}>
              <SelectTrigger className="h-auto border-none shadow-none p-0 gap-1 focus:ring-0 w-auto [&>svg:last-child]:hidden">
                <StatusBadge
                  label={PRIORITY_LABEL[project.priority] ?? project.priority}
                  variant={PRIORITY_VARIANT[project.priority] ?? "default"}
                  size="xs"
                />
              </SelectTrigger>
              <SelectContent>
                {priorityOptions.map(p => (
                  <SelectItem key={p.value} value={p.value}>
                    <StatusBadge label={p.label} variant={PRIORITY_VARIANT[p.value] ?? "default"} size="xs" />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <span className="text-muted-foreground/30">·</span>

            <Popover>
              <PopoverTrigger asChild>
                <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground h-7 px-2 rounded-md hover:bg-accent/50">
                  <Users className="h-3 w-3" />
                  {(() => {
                    const teamCount = (project.assignees || []).length + (project.owner_id ? 1 : 0);
                    if (!project.owner_id && teamCount === 0) return "Add team";
                    const ownerName = project.owner_id ? getName(project.owner_id).split(" ")[0] : null;
                    return ownerName ? `${ownerName}${teamCount > 1 ? ` +${teamCount - 1}` : ""}` : `${teamCount} team`;
                  })()}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-1" align="start">
                <div className="px-2 py-1.5 text-[10px] uppercase tracking-wide text-muted-foreground flex items-center justify-between">
                  <span>Team</span>
                  <span className="flex items-center gap-1 normal-case tracking-normal text-muted-foreground/70">
                    <Crown className="h-3 w-3" /> = owner
                  </span>
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {profiles.map((p) => {
                    const isOwner = project.owner_id === p.user_id;
                    const isMember = isOwner || (project.assignees || []).includes(p.user_id);
                    return (
                      <div
                        key={p.user_id}
                        className={`group flex items-center gap-2 px-2 py-1.5 text-sm rounded-md hover:bg-accent/60 ${isMember ? "bg-accent/30" : ""}`}
                      >
                        <button
                          onClick={() => {
                            const current: string[] = project.assignees || [];
                            if (isOwner) {
                              updateProject({ owner_id: null });
                              logActivity("owner_changed", { new_owner: null });
                              return;
                            }
                            if (isMember) {
                              updateProject({ assignees: current.filter((x) => x !== p.user_id) });
                            } else {
                              updateProject({ assignees: [...current, p.user_id] });
                            }
                          }}
                          className="flex-1 min-w-0 text-left truncate"
                        >
                          {p.full_name || "Unknown"}
                        </button>
                        {isMember && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isOwner) return;
                              const current: string[] = project.assignees || [];
                              updateProject({
                                owner_id: p.user_id,
                                assignees: current.filter((x) => x !== p.user_id),
                              });
                              logActivity("owner_changed", { new_owner: p.user_id });
                            }}
                            title={isOwner ? "Owner" : "Make owner"}
                            className={`shrink-0 rounded-md p-1 transition-colors ${
                              isOwner
                                ? "text-amber-500"
                                : "text-muted-foreground/40 opacity-0 group-hover:opacity-100 hover:text-amber-500 hover:bg-accent"
                            }`}
                          >
                            <Crown className="h-3.5 w-3.5" fill={isOwner ? "currentColor" : "none"} />
                          </button>
                        )}
                        {isMember && !isOwner && (
                          <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>

            <span className="text-muted-foreground/30">·</span>

            <Popover>
              <PopoverTrigger asChild>
                <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground h-7 px-2 rounded-md hover:bg-accent/50">
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
                      <Button key={opt.label} variant="ghost" size="sm" className="h-7 text-xs" onClick={() => updateProject({ due_date: format(opt.date, "yyyy-MM-dd") })}>
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

            {goalTitle && (
              <>
                <span className="text-muted-foreground/30">·</span>
                <button
                  onClick={() => setPeekGoalId(project.goal_id)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground h-7 px-2 rounded-md hover:bg-accent/50 transition-colors"
                >
                  <Target className="h-3 w-3" /> {goalTitle}
                </button>
              </>
            )}
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

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mb-6 border-b border-border/50 rounded-none bg-transparent w-full justify-start gap-2 p-0 h-auto">
              <TabsTrigger value="overview" className="gap-1.5 data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-2.5">
                <LayoutDashboard className="h-3.5 w-3.5" /> Overview
              </TabsTrigger>
              <TabsTrigger value="tasks" className="gap-1.5 data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-2.5">
                <CheckSquare className="h-3.5 w-3.5" /> Tasks
                {tasks.length > 0 && <span className="text-[10px] text-muted-foreground">({tasks.length})</span>}
              </TabsTrigger>
              <TabsTrigger value="whiteboards" className="gap-1.5 data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-2.5">
                <PenLine className="h-3.5 w-3.5" /> Whiteboards
              </TabsTrigger>
              <TabsTrigger value="files" className="gap-1.5 data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-2.5">
                <FolderOpen className="h-3.5 w-3.5" /> Files
                {attachments.length > 0 && <span className="text-[10px] text-muted-foreground">({attachments.length})</span>}
              </TabsTrigger>
              <TabsTrigger value="ai" className="gap-1.5 data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-2.5">
                <Sparkles className="h-3.5 w-3.5" /> AI
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-0">
              <ProjectOverviewTab
                project={project}
                tasks={tasks}
                linkedDocs={linkedDocs}
                attachments={attachments}
                profiles={profiles}
                onOpenTab={setActiveTab}
                onNotesChange={(html) => updateProject({ notes_content: html })}
                onFilesChanged={fetchData}
              />
            </TabsContent>
            <TabsContent value="tasks" className="mt-0">
              <ProjectTasksTab
                tasks={tasks}
                profiles={profiles}
                onCreate={createTask}
                onStatusChange={updateTaskStatus}
                onChanged={fetchData}
              />
            </TabsContent>
            <TabsContent value="whiteboards" className="mt-0">
              <ProjectWhiteboardsTab />
            </TabsContent>
            <TabsContent value="files" className="mt-0">
              <ProjectFilesTab attachments={attachments} projectId={project.id} onChanged={fetchData} />
            </TabsContent>
            <TabsContent value="ai" className="mt-0">
              <ProjectAiTab
                project={project}
                tasks={tasks}
                profiles={profiles}
                linkedDocs={linkedDocs}
                goalTitle={goalTitle}
                onTasksCreated={fetchData}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <ProjectChatRail open={chatOpen} onClose={() => setChatOpen(false)} projectId={project.id} />

      <GoalPeek
        goalId={peekGoalId}
        onClose={() => setPeekGoalId(null)}
        allProjects={[]}
        getName={getName}
        onChanged={fetchData}
        onOpenProject={(pid) => { setPeekGoalId(null); navigate(`/projects/${pid}`); }}
      />
    </div>
  );
}
