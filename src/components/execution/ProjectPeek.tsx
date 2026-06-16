// ProjectPeek — slide-over Project view. The default way projects open.
//
// Replaces the multi-tab full page as the primary surface. Layout:
//
//   ┌─────────────────────────────────────┬───────────────────┐
//   │ Title + meta             Expand ↗  │  TEAM             │
//   │                                     │                   │
//   │ ▼ Notes (collapsed by default)      │  COMMENTS         │
//   │ ▼ Tasks (inline checklist)          │  (chat composer)  │
//   │ ▼ Files (collapsed list)            │                   │
//   └─────────────────────────────────────┴───────────────────┘
//
// AI lives inside Comments — @mention Albus to ask questions about the project.
// "Expand ↗" routes to the existing /projects/:id full page for deep work.

import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  ChevronDown, ChevronRight, ExternalLink, FolderOpen, FileText,
  CheckSquare, Plus, Loader2, Upload, X, Users,
} from "lucide-react";
import { toast } from "sonner";
import RichTextEditor from "@/components/RichTextEditor";
import ActivityPanel from "@/components/activity/ActivityPanel";
import { cn } from "@/lib/utils";
import { CoverImageZone, CoverMenuItems } from "@/components/primitives";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  StatusBadge,
  PROJECT_STATUS_VARIANT, PROJECT_STATUS_LABEL,
  PRIORITY_VARIANT, PRIORITY_LABEL,
} from "@/components/shared/StatusBadge";

const sb = supabase as any;

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

interface Props {
  projectId: string | null;
  onClose: () => void;
  onChanged?: () => void;
}

export default function ProjectPeek({ projectId, onClose, onChanged }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [project, setProject] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<{ user_id: string; full_name: string | null; avatar_url: string | null }[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false); // collapsed by default
  const [filesOpen, setFilesOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [notesSaveTimer, setNotesSaveTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    const [{ data: p }, { data: t }, { data: profs }] = await Promise.all([
      sb.from("projects").select("*").eq("id", projectId).maybeSingle(),
      sb.from("tasks").select("*").eq("project_id", projectId).order("created_at"),
      sb.from("profiles").select("user_id, full_name, avatar_url").limit(100),
    ]);
    setProject(p);
    setTasks(t ?? []);
    setFiles([]); // files managed in expanded view for now
    setProfiles(profs ?? []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { if (projectId) load(); else setProject(null); }, [projectId, load]);

  const update = useCallback(async (patch: Record<string, any>) => {
    if (!project) return;
    setProject({ ...project, ...patch });
    await sb.from("projects").update(patch).eq("id", project.id);
    onChanged?.();
  }, [project, onChanged]);

  const saveNotesDebounced = (html: string) => {
    setProject((p: any) => p ? { ...p, notes_content: html } : p);
    if (notesSaveTimer) clearTimeout(notesSaveTimer);
    const t = setTimeout(() => {
      sb.from("projects").update({ notes_content: html }).eq("id", project!.id);
    }, 600);
    setNotesSaveTimer(t);
  };

  const addTask = async () => {
    if (!newTaskTitle.trim() || !user || !project) return;
    const { data, error } = await sb.from("tasks").insert({
      title: newTaskTitle.trim(),
      project_id: project.id,
      status: "todo",
      priority: "medium",
      created_by: user.id,
      assigned_to: user.id,
    }).select().single();
    if (error) { toast.error(error.message); return; }
    setTasks((prev) => [...prev, data]);
    setNewTaskTitle("");
  };

  const toggleTaskDone = async (taskId: string, currentStatus: string) => {
    const nextStatus = currentStatus === "done" ? "todo" : "done";
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: nextStatus } : t)));
    await sb.from("tasks").update({ status: nextStatus }).eq("id", taskId);
  };

  const getName = (uid: string | null) => profiles.find((p) => p.user_id === uid)?.full_name ?? "Unknown";
  const owner = useMemo(() => profiles.find((p) => p.user_id === project?.owner_id), [profiles, project]);
  const taskStats = useMemo(() => {
    const done = tasks.filter((t) => t.status === "done").length;
    return { done, total: tasks.length };
  }, [tasks]);

  if (!projectId) return null;

  return (
    <Sheet open={!!projectId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[1100px] p-0 overflow-hidden flex flex-col"
      >
        {loading || !project ? (
          <div className="flex items-center gap-2 px-6 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading project…
          </div>
        ) : (
          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* Left main column */}
            <div className="flex-1 min-w-0 flex flex-col overflow-y-auto">
              {/* Cover image (only when set — added via the (⋯) menu). */}
              {(project as any).cover_url && (
                <div className="px-6 pt-5">
                  <CoverImageZone
                    url={(project as any).cover_url}
                    onChange={(url) => update({ cover_url: url })}
                  />
                </div>
              )}

              {/* Header */}
              <div className={cn(
                "px-6 border-b border-border/40 shrink-0",
                (project as any).cover_url ? "pt-3 pb-5" : "py-5",
              )}>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <FolderOpen className="h-5 w-5 text-muted-foreground shrink-0" />
                    <input
                      value={project.title}
                      onChange={(e) => setProject({ ...project, title: e.target.value })}
                      onBlur={(e) => update({ title: e.target.value })}
                      className="text-xl font-bold bg-transparent outline-none flex-1 min-w-0"
                    />
                  </div>
                  <button
                    onClick={() => { onClose(); navigate(`/projects/${project.id}`); }}
                    className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground px-2 py-1 rounded-md border border-border/40 hover:bg-muted shrink-0"
                    title="Open full page"
                  >
                    Expand <ExternalLink className="h-3 w-3" />
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted shrink-0"
                        aria-label="More actions"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                      <CoverMenuItems
                        url={(project as any).cover_url}
                        onChange={(url) => update({ cover_url: url })}
                      />
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Select value={project.status} onValueChange={v => update({ status: v })}>
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
                  {project.priority && (
                    <>
                      <span className="text-muted-foreground/40">·</span>
                      <Select value={project.priority} onValueChange={v => update({ priority: v })}>
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
                    </>
                  )}
                  {owner && (
                    <>
                      <span className="text-muted-foreground/40">·</span>
                      <span className="text-xs text-muted-foreground">{owner.full_name}</span>
                    </>
                  )}
                  {project.due_date && (
                    <>
                      <span className="text-muted-foreground/40">·</span>
                      <span className="text-xs text-muted-foreground">Due {project.due_date}</span>
                    </>
                  )}
                </div>
              </div>

              <div className="px-6 py-5 space-y-5">
                {/* Description (always shown, small) */}
                {(project.description || true) && (
                  <textarea
                    value={project.description ?? ""}
                    onChange={(e) => setProject({ ...project, description: e.target.value })}
                    onBlur={(e) => update({ description: e.target.value })}
                    placeholder="Short description…"
                    className="w-full text-sm bg-transparent outline-none resize-none placeholder:text-muted-foreground/40"
                    rows={2}
                  />
                )}

                {/* Notes — collapsed by default */}
                <Collapsible open={notesOpen} onOpenChange={setNotesOpen}>
                  <CollapsibleTrigger className="flex items-center gap-2 text-sm font-semibold text-foreground/80 hover:text-foreground py-1">
                    {notesOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    <FileText className="h-3.5 w-3.5" /> Notes
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2">
                    <RichTextEditor
                      key={project.id}
                      content={project.notes_content ?? ""}
                      onChange={saveNotesDebounced}
                      placeholder="Notes, context, scope, plan… Type / for commands."
                      borderless
                    />
                  </CollapsibleContent>
                </Collapsible>

                {/* Tasks — inline checklist */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground/80 py-1">
                    <CheckSquare className="h-3.5 w-3.5" />
                    Tasks
                    <span className="text-[10px] text-muted-foreground font-normal">
                      {taskStats.done} / {taskStats.total}
                    </span>
                  </div>

                  <div className="space-y-1">
                    {tasks.map((t) => (
                      <div
                        key={t.id}
                        className="group flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/40 transition-colors"
                      >
                        <button
                          onClick={() => toggleTaskDone(t.id, t.status)}
                          className={cn(
                            "h-4 w-4 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors",
                            t.status === "done"
                              ? "bg-emerald-500 border-emerald-500 text-white"
                              : "border-muted-foreground/40 hover:border-primary",
                          )}
                        >
                          {t.status === "done" && <span className="text-[10px]">✓</span>}
                        </button>
                        <span className={cn(
                          "flex-1 text-sm",
                          t.status === "done" && "line-through text-muted-foreground",
                        )}>
                          {t.title}
                        </span>
                        {t.priority && t.priority !== "medium" && (
                          <StatusBadge label={PRIORITY_LABEL[t.priority] ?? t.priority} variant={PRIORITY_VARIANT[t.priority] ?? "default"} size="xs" />
                        )}
                        {t.assigned_to && (
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {getName(t.assigned_to).split(" ")[0]}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 px-2 py-1.5 rounded-md border border-dashed border-border/40">
                    <Plus className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <input
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") addTask(); }}
                      placeholder="Add a task…"
                      className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground/40"
                    />
                  </div>
                </div>

                {/* Files — collapsed */}
                <Collapsible open={filesOpen} onOpenChange={setFilesOpen}>
                  <CollapsibleTrigger className="flex items-center gap-2 text-sm font-semibold text-foreground/80 hover:text-foreground py-1">
                    {filesOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    <Upload className="h-3.5 w-3.5" /> Files
                    <span className="text-[10px] text-muted-foreground font-normal">{files.length}</span>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2">
                    {files.length === 0 ? (
                      <p className="text-xs text-muted-foreground/60 italic px-2">No files yet.</p>
                    ) : (
                      <ul className="space-y-1">
                        {files.slice(0, 10).map((f: any) => (
                          <li key={f.id}>
                            <a
                              href={f.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/40 text-sm"
                            >
                              <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <span className="truncate flex-1">{f.name}</span>
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              </div>
            </div>

            {/* Right rail */}
            <aside className="w-[400px] shrink-0 border-l border-border/40 bg-card/30 flex flex-col overflow-hidden">
              {/* Team */}
              <div className="px-4 py-3 border-b border-border/40 shrink-0">
                <div className="flex items-center gap-2 mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  <Users className="h-3 w-3" /> Team
                </div>
                <div className="space-y-1.5">
                  {owner && (
                    <div className="flex items-center gap-2">
                      <UserAvatar name={owner.full_name} avatarUrl={owner.avatar_url} className="h-6 w-6" fallbackClassName="text-[10px] bg-muted" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{owner.full_name}</p>
                        <p className="text-[10px] text-muted-foreground">Owner</p>
                      </div>
                    </div>
                  )}
                  {(project.assignees ?? []).map((uid: string) => {
                    if (uid === project.owner_id) return null;
                    const p = profiles.find((pr) => pr.user_id === uid);
                    if (!p) return null;
                    return (
                      <div key={uid} className="flex items-center gap-2">
                        <UserAvatar name={p.full_name} avatarUrl={p.avatar_url} className="h-6 w-6" fallbackClassName="text-[10px] bg-muted" />
                        <p className="text-xs truncate flex-1">{p.full_name}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Comments — with @Albus support via the inline activity panel */}
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                <div className="px-4 pt-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground shrink-0 border-t border-border/40">
                  Comments · @Albus
                </div>
                <div className="flex-1 min-h-0 overflow-hidden flex flex-col px-2 py-2">
                  <ActivityPanel entityType="project" entityId={project.id} hideHeader />
                </div>
              </div>
            </aside>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
