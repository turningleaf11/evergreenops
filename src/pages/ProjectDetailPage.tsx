import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format, addDays, addMonths, startOfTomorrow, startOfToday } from "date-fns";
import {
  Link2, Calendar, Users, X, Target, Check, Crown,
  List, PenLine, FolderOpen, Sparkles, MoreHorizontal, Info, MessageSquare, Plus,
  LayoutGrid, GanttChartSquare, CalendarDays,
  Copy, Archive, Trash2,
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { markEntityNotificationsRead } from "@/lib/notifications";
import { useUnreadEntityIds } from "@/hooks/useUnreadEntityIds";
import { cn } from "@/lib/utils";
import { StatusPill, PriorityPill } from "@/components/primitives";
import ProjectOverviewTab from "@/components/execution/ProjectOverviewTab";
import ProjectTasksTab from "@/components/execution/ProjectTasksTab";
import ProjectWhiteboardsTab from "@/components/execution/ProjectWhiteboardsTab";
import ProjectFilesTab from "@/components/execution/ProjectFilesTab";
import ActivityPanel from "@/components/activity/ActivityPanel";
import GoalPeek from "@/components/execution/GoalPeek";
import WorkItemPeek from "@/components/execution/WorkItemPeek";
import { ProjectBoardView, ProjectCalendarView, ProjectTimelineView, type ProjectViewType } from "@/components/execution/ProjectTaskViews";
import { useReportActiveEntity, useCompanion } from "@/contexts/CompanionContext";
import { useProjectWorkItems, type WorkItemKind } from "@/hooks/useProjectWorkItems";

// List is the built-in first view; Whiteboards/Files are built-in surfaces.
// Board/Calendar/Timeline are user-added, persisted per-project in project_views.
// AI lives in Albus now (the FAB) — open it while viewing this project for the
// same propose-tasks capability the old per-project AI tab had.
const EXTRA_VIEWS = [
  { id: "whiteboards", label: "Whiteboards", icon: PenLine },
  { id: "files",       label: "Files",       icon: FolderOpen },
];

const ADD_VIEW_OPTIONS: { type: ProjectViewType; label: string; icon: any }[] = [
  { type: "board",    label: "Board",    icon: LayoutGrid },
  { type: "calendar", label: "Calendar", icon: CalendarDays },
  { type: "timeline", label: "Timeline", icon: GanttChartSquare },
];
const VIEW_TYPE_ICON: Record<string, any> = {
  board: LayoutGrid, calendar: CalendarDays, timeline: GanttChartSquare,
};

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const unreadTaskIds = useUnreadEntityIds("task");

  const [project, setProject] = useState<any>(null);
  const {
    items: workItems, tasks, agents: agentsMeta, repos, profiles, existingCandidates,
    getAssigneeName: getName, updateStatus: updateItemStatus,
    updateFields: updateItemFields, createItem: createWorkItemRaw, linkExisting,
    refetch: refetchWorkItems,
  } = useProjectWorkItems(id);
  const [goals, setGoals] = useState<any[]>([]);
  const [linkedDocs, setLinkedDocs] = useState<any[]>([]);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [commentCount, setCommentCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [newTagInput, setNewTagInput] = useState("");
  const [peekGoalId, setPeekGoalId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [views, setViews] = useState<any[]>([]);
  const [peekItem, setPeekItem] = useState<{ id: string; kind: WorkItemKind } | null>(null);

  const tabKey = id ? `project-view-${id}` : "project-view";
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (typeof window === "undefined") return "list";
    const stored = localStorage.getItem(tabKey);
    // Allow built-ins and saved-view ids; legacy "overview"/"tasks" → list.
    if (stored && stored !== "overview" && stored !== "tasks") return stored;
    return "list";
  });

  useEffect(() => {
    if (id) localStorage.setItem(tabKey, activeTab);
  }, [activeTab, tabKey, id]);

  const fetchData = useCallback(async () => {
    if (!id) return;
    const [pRes, gRes, dRes, aRes, cRes, vRes] = await Promise.all([
      supabase.from("projects").select("*").eq("id", id).single(),
      supabase.from("goals").select("id, title"),
      supabase.from("documents").select("id, title, updated_at, content").eq("project_id", id).order("updated_at", { ascending: false }),
      supabase.from("project_attachments").select("*").eq("project_id", id).order("created_at", { ascending: false }),
      supabase.from("comments").select("id", { count: "exact", head: true }).eq("entity_type", "project").eq("entity_id", id),
      (supabase as any).from("project_views").select("*").eq("project_id", id).order("position"),
    ]);
    if (pRes.data) { setProject(pRes.data); setTitleDraft(pRes.data.title); }
    if (gRes.data) setGoals(gRes.data);
    if (dRes.data) setLinkedDocs(dRes.data);
    if (aRes.data) setAttachments(aRes.data);
    setCommentCount(cRes.count ?? 0);
    if (vRes.data) setViews(vRes.data);
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { if (id) markEntityNotificationsRead("project", id); }, [id]);

  // Tell Albus which project you're viewing (context-aware).
  useReportActiveEntity(project ? { type: "project", id: project.id, title: project.title } : null);
  const companion = useCompanion();

  // When Albus adds tasks he proposed for this project (the old per-project AI
  // tab's capability, folded into the companion), refetch so the List/Board/
  // Calendar/Timeline views pick them up.
  useEffect(() => {
    const onTasksCreated = (e: Event) => {
      const detail = (e as CustomEvent).detail as { projectId?: string } | undefined;
      if (detail?.projectId === id) { fetchData(); refetchWorkItems(); }
    };
    window.addEventListener("albus-tasks-created", onTasksCreated);
    return () => window.removeEventListener("albus-tasks-created", onTasksCreated);
  }, [id, fetchData, refetchWorkItems]);

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

  // List/Board/Calendar/Timeline all read useProjectWorkItems' merged
  // `items` and call its create/update/status mutators directly — this page
  // only needs to supply the creating user.
  const createWorkItem = (data: Parameters<typeof createWorkItemRaw>[0]) =>
    createWorkItemRaw(data, user?.id);

  const addView = async (type: ProjectViewType, label: string) => {
    const { data, error } = await (supabase as any)
      .from("project_views")
      .insert({ project_id: id, type, name: label, position: views.length, created_by: user?.id })
      .select("*")
      .single();
    if (error) { toast.error(error.message); return; }
    setViews((prev) => [...prev, data]);
    setActiveTab(data.id);
  };

  const removeView = async (viewId: string) => {
    const { error } = await (supabase as any).from("project_views").delete().eq("id", viewId);
    if (error) { toast.error(error.message); return; }
    setViews((prev) => prev.filter((v) => v.id !== viewId));
    if (activeTab === viewId) setActiveTab("list");
  };

  // Details and Activity are peer right-panels — one at a time.
  const openDetails = () => { setActivityOpen(false); setDetailsOpen(true); };
  const openActivity = () => { setDetailsOpen(false); setActivityOpen(true); };

  const duplicateProject = async () => {
    const { id: _id, created_at, updated_at, ...rest } = project;
    const { data: newProj, error } = await supabase
      .from("projects")
      .insert({ ...rest, title: `${project.title} (copy)`, archived: false } as any)
      .select("id")
      .single();
    if (error || !newProj) { toast.error(error?.message || "Couldn't duplicate project"); return; }
    if (tasks.length) {
      const rows = tasks.map((t) => ({
        title: t.title, status: t.status, priority: t.priority, description: t.description,
        assigned_to: t.assigned_to, due_date: t.due_date, subtasks: t.subtasks,
        notes_content: t.notes_content, project_id: newProj.id, created_by: user?.id,
      }));
      await supabase.from("tasks").insert(rows as any);
    }
    toast.success("Project duplicated");
    navigate(`/projects/${newProj.id}`);
  };

  const archiveProject = async () => {
    const { error } = await supabase.from("projects").update({ archived: true } as any).eq("id", id!);
    if (error) { toast.error(error.message); return; }
    toast.success("Project archived");
    navigate(-1);
  };

  const deleteProject = async () => {
    const { error } = await (supabase as any).rpc("delete_project_cascade", { p_id: id });
    if (error) { toast.error(error.message); return; }
    toast.success("Project deleted");
    navigate(-1);
  };

  if (loading) return <div className="p-6 text-center text-muted-foreground">Loading...</div>;
  if (!project) return <div className="p-6 text-center text-muted-foreground">Project not found.</div>;

  const goalTitle = goals.find(g => g.id === project.goal_id)?.title;
  const activeView = views.find((v) => v.id === activeTab);

  const tabClass = (active: boolean) =>
    cn(
      "flex items-center gap-1.5 text-sm px-2 pb-3 pt-1.5 border-b-2 transition-colors -mb-px whitespace-nowrap",
      active ? "border-primary text-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground",
    );

  return (
    <div className="relative h-full flex flex-col overflow-hidden">
      {/* ── Header = the record ─────────────────────────────────────────── */}
      <div className="px-6 pt-5 shrink-0">
        {/* Title row — lifecycle inline + record affordances on the right */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => navigate(-1)}
            title="Back to projects"
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors rounded p-0.5 hover:bg-accent/60"
          >
            <FolderOpen className="h-5 w-5" />
          </button>
          {editingTitle ? (
            <Input
              value={titleDraft}
              onChange={e => setTitleDraft(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={e => e.key === "Enter" && saveTitle()}
              autoFocus
              className="text-xl font-bold h-auto py-0.5 px-2 border-none shadow-none focus-visible:ring-1"
            />
          ) : (
            <h1
              className="text-xl font-bold cursor-pointer hover:bg-accent/30 rounded px-2 -mx-1 py-0.5 truncate"
              onClick={() => setEditingTitle(true)}
            >
              {project.title}
            </h1>
          )}

          <span className="text-muted-foreground/30 mx-0.5">·</span>
          <StatusPill
            kind="project"
            value={project.status}
            onChange={v => { updateProject({ status: v }); logActivity("status_changed", { new_status: v }); }}
          />
          <span className="text-muted-foreground/30">·</span>
          <PriorityPill
            value={project.priority || "medium"}
            size="sm"
            onChange={v => { updateProject({ priority: v }); logActivity("priority_changed", { new_priority: v }); }}
          />

          <div className="ml-auto flex items-center gap-1">
            {/* Ask Albus — the old per-project AI tab folded into the companion.
                Opens the docked Albus, already scoped to this project via
                useReportActiveEntity above (propose_tasks works from here). */}
            <button
              onClick={() => companion.setOpen(true)}
              className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
              title="Ask Albus about this project"
              aria-label="Ask Albus about this project"
            >
              <Sparkles className="h-4 w-4" />
            </button>
            {/* Info → Details panel (reference; rarely opened) */}
            <button
              onClick={openDetails}
              className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
              title="Project details"
              aria-label="Project details"
            >
              <Info className="h-4 w-4" />
            </button>
            {/* Comment → Activity panel (living pulse; badge keeps it discoverable) */}
            <button
              onClick={openActivity}
              className="relative h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
              title="Activity"
              aria-label="Activity"
            >
              <MessageSquare className="h-4 w-4" />
              {commentCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-3.5 min-w-3.5 px-0.5 rounded-full bg-primary text-primary-foreground text-[9px] font-semibold flex items-center justify-center">
                  {commentCount}
                </span>
              )}
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
                  aria-label="More"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success("Link copied"); }}>
                  <Link2 className="h-3.5 w-3.5 mr-2" /> Copy link
                </DropdownMenuItem>
                <DropdownMenuItem onClick={duplicateProject}>
                  <Copy className="h-3.5 w-3.5 mr-2" /> Duplicate
                </DropdownMenuItem>
                <DropdownMenuItem onClick={archiveProject}>
                  <Archive className="h-3.5 w-3.5 mr-2" /> Archive
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setDeleteOpen(true)} className="text-destructive focus:text-destructive">
                  <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Quick-glance meta — goal, team, date. The rest lives in the Details panel. */}
        <div className="flex items-center gap-4 mt-3 ml-7 flex-wrap">
          {goalTitle && (
            <button
              onClick={() => setPeekGoalId(project.goal_id)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Target className="h-3 w-3" /> {goalTitle}
            </button>
          )}

          <Popover>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
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

          <Popover>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
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
        </div>
      </div>

      {/* ── View row = the container. List + saved views + built-in surfaces. ── */}
      <div className="flex items-center gap-1 px-6 mt-4 border-b border-border/50 shrink-0 overflow-x-auto">
        {/* List — built-in */}
        <button onClick={() => setActiveTab("list")} className={tabClass(activeTab === "list")}>
          <List className="h-3.5 w-3.5" /> List
          {workItems.length > 0 && <span className="text-[10px] text-muted-foreground">({workItems.length})</span>}
        </button>

        {/* Saved views — user-added, removable */}
        {views.map((v) => {
          const Icon = VIEW_TYPE_ICON[v.type] || LayoutGrid;
          return (
            <div key={v.id} className="group/vt flex items-center -mb-px">
              <button onClick={() => setActiveTab(v.id)} className={tabClass(activeTab === v.id)}>
                <Icon className="h-3.5 w-3.5" /> {v.name}
              </button>
              <button
                onClick={() => removeView(v.id)}
                title="Remove view"
                className="opacity-0 group-hover/vt:opacity-100 transition-opacity text-muted-foreground/60 hover:text-destructive -ml-1 mr-1 p-0.5 rounded"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          );
        })}

        {/* Built-in surfaces */}
        {EXTRA_VIEWS.map(({ id: vid, label, icon: Icon }) => (
          <button key={vid} onClick={() => setActiveTab(vid)} className={tabClass(activeTab === vid)}>
            <Icon className="h-3.5 w-3.5" /> {label}
            {vid === "files" && attachments.length > 0 && <span className="text-[10px] text-muted-foreground">({attachments.length})</span>}
          </button>
        ))}

        {/* + Add view — creates a persisted view */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-1 text-sm px-2 pb-3 pt-1.5 text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap">
              <Plus className="h-3.5 w-3.5" /> Add view
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44">
            {ADD_VIEW_OPTIONS.map(({ type, label, icon: Icon }) => (
              <DropdownMenuItem key={type} onClick={() => addView(type, label)}>
                <Icon className="h-3.5 w-3.5 mr-2 text-muted-foreground" /> {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ── Body = the work, full width ─────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
        {activeTab === "list" && (
          <ProjectTasksTab
            items={workItems}
            profiles={profiles}
            agents={agentsMeta}
            repos={repos}
            projectId={id!}
            getName={getName}
            onCreate={createWorkItem}
            onItemClick={(t) => setPeekItem({ id: t.id, kind: t._kind })}
            onStatusChange={updateItemStatus}
            onUpdate={updateItemFields}
            existingCandidates={existingCandidates}
            onLinkExisting={(c) => linkExisting(c.id, c._kind)}
            unreadIds={unreadTaskIds}
          />
        )}
        {activeView?.type === "board" && (
          <ProjectBoardView items={workItems} profiles={profiles} getName={getName} onItemClick={(t) => setPeekItem({ id: t.id, kind: t._kind })} onStatusChange={updateItemStatus} onFieldChange={updateItemFields} unreadIds={unreadTaskIds} />
        )}
        {activeView?.type === "calendar" && (
          <ProjectCalendarView items={workItems} onItemClick={(t) => setPeekItem({ id: t.id, kind: t._kind })} />
        )}
        {activeView?.type === "timeline" && (
          <ProjectTimelineView items={workItems} onItemClick={(t) => setPeekItem({ id: t.id, kind: t._kind })} />
        )}
        {activeTab === "whiteboards" && <ProjectWhiteboardsTab />}
        {activeTab === "files" && <ProjectFilesTab attachments={attachments} projectId={project.id} onChanged={fetchData} />}
      </div>

      {/* ── Details panel — record properties. Opens on the info icon. ──── */}
      {detailsOpen && (
        <>
          <div className="absolute inset-0 z-20 bg-foreground/10" onClick={() => setDetailsOpen(false)} />
          <aside className="absolute top-0 right-0 z-30 h-full w-[420px] bg-card border-l border-border/60 shadow-xl flex flex-col">
            <div className="flex items-center justify-between px-4 h-12 border-b border-border/50 shrink-0">
              <span className="text-sm font-semibold">Details</span>
              <button onClick={() => setDetailsOpen(false)} className="text-muted-foreground hover:text-foreground" aria-label="Close details">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4">
              <ProjectOverviewTab
                project={project}
                tasks={tasks}
                goals={goals}
                profiles={profiles}
                onNotesChange={(html) => updateProject({ notes_content: html })}
                onGoalChange={(goalId) => { updateProject({ goal_id: goalId }); logActivity("goal_connected", { goal_id: goalId }); }}
                onOpenGoal={(goalId) => setPeekGoalId(goalId)}
              />
              {/* Tags — project metadata, lives with the rest of the record properties */}
              <section className="mt-7">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Tags</h3>
                <div className="flex items-center gap-2 flex-wrap">
                  {(project.tags || []).map((t: string) => (
                    <span key={t} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      {t}
                      <button onClick={() => removeTag(t)} className="hover:text-destructive"><X className="h-2.5 w-2.5" /></button>
                    </span>
                  ))}
                  <Input
                    value={newTagInput}
                    onChange={e => setNewTagInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addTag())}
                    placeholder="+ tag"
                    className="h-6 w-16 text-[11px] border-none shadow-none bg-transparent placeholder:text-muted-foreground/40 px-1"
                  />
                </div>
              </section>
            </div>
          </aside>
        </>
      )}

      {/* ── Activity panel — unified comments + events. Opens on the comment icon. ── */}
      {activityOpen && (
        <>
          <div className="absolute inset-0 z-20 bg-foreground/10" onClick={() => setActivityOpen(false)} />
          <aside className="absolute top-0 right-0 z-30 h-full w-[440px] bg-card border-l border-border/60 shadow-xl flex flex-col">
            <div className="flex items-center justify-between px-4 h-12 border-b border-border/50 shrink-0">
              <span className="text-sm font-semibold">Activity</span>
              <button onClick={() => setActivityOpen(false)} className="text-muted-foreground hover:text-foreground" aria-label="Close activity">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden px-3 pt-2">
              <ActivityPanel entityType="project" entityId={project.id} hideHeader />
            </div>
          </aside>
        </>
      )}

      <GoalPeek
        goalId={peekGoalId}
        onClose={() => setPeekGoalId(null)}
        allProjects={[]}
        getName={getName}
        onChanged={fetchData}
        onOpenProject={(pid) => { setPeekGoalId(null); navigate(`/projects/${pid}`); }}
      />

      {/* One peek for every view — List, Board, Calendar, Timeline all set
          peekItem the same way; WorkItemPeek picks TaskPeek vs AgentTaskDetail. */}
      <WorkItemPeek peek={peekItem} onClose={() => { setPeekItem(null); refetchWorkItems(); }} />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this project?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes <span className="font-medium text-foreground">{project.title}</span>
              {tasks.length > 0 && <> and its {tasks.length} task{tasks.length === 1 ? "" : "s"}</>}, along with
              its comments, activity, and attachments. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteProject}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete project
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
