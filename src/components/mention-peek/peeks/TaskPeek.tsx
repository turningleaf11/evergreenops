import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Calendar, User, CheckCircle2, Loader2, Plus, X, Paperclip, Flag, Folder, Check,
  FileText, ExternalLink,
} from "lucide-react";
import { format, startOfToday, startOfTomorrow, addDays, addMonths } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ActivityPanel from "@/components/activity/ActivityPanel";
import { ActivityComposer, type ActivitySubmitPayload } from "@/components/activity/ActivityComposer";
import RichTextEditor from "@/components/RichTextEditor";
import { StatusPill, PriorityPill } from "@/components/primitives";
import { useReportActiveEntity } from "@/contexts/CompanionContext";
import { cn } from "@/lib/utils";

const sb = supabase as any;

interface Subtask { id: string; title: string; done: boolean; }
interface LinkedDoc { id: string; linkId: string; title: string; updated_at: string; }
interface ProjectDoc { id: string; title: string; linked: boolean; }

interface Props { id: string; open: boolean; onClose: () => void; }

function FieldRow({ icon: Icon, label, children }: { icon: any; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-24 shrink-0 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

export default function TaskPeek({ id, open, onClose }: Props) {
  const navigate = useNavigate();
  const [row, setRow] = useState<any>(null);
  const [profiles, setProfiles] = useState<{ user_id: string; full_name: string | null }[]>([]);
  const [projectTitle, setProjectTitle] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [newSubtask, setNewSubtask] = useState("");
  const [linkedDocs, setLinkedDocs] = useState<LinkedDoc[]>([]);
  const [projectDocs, setProjectDocs] = useState<ProjectDoc[]>([]);
  const [creatingDoc, setCreatingDoc] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);

  const loadDocs = useCallback(async (projectId: string | null) => {
    const { data: links } = await sb
      .from("document_links")
      .select("id, document_id, documents(id, title, updated_at)")
      .eq("entity_type", "task")
      .eq("entity_id", id);
    const linked: LinkedDoc[] = (links || [])
      .filter((l: any) => l.documents)
      .map((l: any) => ({ id: l.documents.id, linkId: l.id, title: l.documents.title, updated_at: l.documents.updated_at }));
    setLinkedDocs(linked);

    if (projectId) {
      const { data: docs } = await supabase.from("documents").select("id, title").eq("project_id", projectId);
      const linkedIds = new Set(linked.map((l) => l.id));
      setProjectDocs((docs || []).map((d: any) => ({ id: d.id, title: d.title, linked: linkedIds.has(d.id) })));
    } else {
      setProjectDocs([]);
    }
  }, [id]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("tasks").select("*").eq("id", id).maybeSingle();
    if (data && !Array.isArray(data.subtasks)) data.subtasks = [];
    setRow(data);

    const { data: profs } = await supabase.from("profiles").select("user_id, full_name");
    setProfiles(profs || []);

    if (data?.project_id) {
      const { data: proj } = await supabase.from("projects").select("title").eq("id", data.project_id).maybeSingle();
      setProjectTitle(proj?.title || "");
    } else {
      setProjectTitle("");
    }

    await loadDocs(data?.project_id || null);
    setLoading(false);
  }, [id, loadDocs]);

  useEffect(() => { if (open && id) load(); }, [open, id, load]);

  // Tell Albus which task you're viewing while the peek is open.
  useReportActiveEntity(open && row ? { type: "task", id, title: row.title } : null);

  const updateTask = async (updates: Record<string, any>) => {
    if (!row) return;
    const { error } = await supabase.from("tasks").update(updates).eq("id", id);
    if (error) toast.error(error.message);
    else setRow({ ...row, ...updates });
  };

  const handleComment = async (payload: ActivitySubmitPayload) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setSubmittingComment(true);
    await supabase.from("comments").insert({
      entity_type: "task", entity_id: id,
      author_id: user.id,
      content: payload.contentText,
      content_html: payload.contentHtml,
      parent_id: null,
      attachments: payload.attachments as any,
      mentions: payload.mentions as any,
      gif_url: payload.gifUrl,
      audio_url: payload.audioUrl,
    } as any);
    setSubmittingComment(false);
    // ActivityPanel's realtime subscription picks up the new comment automatically
  };

  const assignee = profiles.find((p) => p.user_id === row?.assigned_to);
  const subtasks: Subtask[] = row?.subtasks || [];
  const doneSubtasks = subtasks.filter((s) => s.done).length;
  const isDone = row?.status === "done";

  const addSubtask = () => {
    if (!newSubtask.trim()) return;
    updateTask({ subtasks: [...subtasks, { id: crypto.randomUUID(), title: newSubtask.trim(), done: false }] });
    setNewSubtask("");
  };

  const toggleSubtask = (stId: string) =>
    updateTask({ subtasks: subtasks.map((s) => (s.id === stId ? { ...s, done: !s.done } : s)) });

  const removeSubtask = (stId: string) =>
    updateTask({ subtasks: subtasks.filter((s) => s.id !== stId) });

  const goToProject = () => {
    if (!row?.project_id) return;
    navigate(`/projects/${row.project_id}`);
    onClose();
  };

  const openDoc = (docId: string) => {
    navigate(`/docs?id=${docId}`);
    onClose();
  };

  const linkExistingDoc = async (docId: string) => {
    const { error } = await sb.from("document_links").insert({ document_id: docId, entity_type: "task", entity_id: id });
    if (error) { toast.error(error.message); return; }
    loadDocs(row?.project_id || null);
  };

  const unlinkDoc = async (linkId: string) => {
    const { error } = await sb.from("document_links").delete().eq("id", linkId);
    if (error) { toast.error(error.message); return; }
    loadDocs(row?.project_id || null);
  };

  const createDoc = async () => {
    setCreatingDoc(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: doc, error } = await supabase
        .from("documents")
        .insert({ title: row.title || "Untitled", content: "", author_id: user?.id, project_id: row.project_id || null })
        .select("id").single();
      if (error) throw error;
      await sb.from("document_links").insert({ document_id: doc.id, entity_type: "task", entity_id: id });
      await loadDocs(row?.project_id || null);
      toast.success("Doc created and linked");
    } catch (e: any) {
      toast.error(e.message || "Failed to create doc");
    } finally {
      setCreatingDoc(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-[680px] p-0 overflow-hidden flex flex-col">
        {loading || !row ? (
          <div className="flex items-center gap-2 px-5 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading task…
          </div>
        ) : (
          <>
            {/* ── Single scroll container ── everything flows, accent section grows with content ── */}
            <div className="flex-1 overflow-y-auto">

              {/* Action bar */}
              <div className="flex items-center px-5 pt-4 pb-1">
                <button
                  onClick={() => updateTask({ status: isDone ? "todo" : "done" })}
                  className={cn(
                    "flex items-center gap-1.5 h-8 px-3 rounded-md border text-xs font-medium transition-colors",
                    isDone
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-border/60 text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                  )}
                >
                  <CheckCircle2 className={cn("h-3.5 w-3.5", isDone && "fill-primary/20")} />
                  {isDone ? "Completed" : "Mark complete"}
                </button>
              </div>

              {/* Title + fields */}
              <div className="px-5 pt-2 pb-5">
                <input
                  value={row.title}
                  onChange={(e) => setRow({ ...row, title: e.target.value })}
                  onBlur={(e) => updateTask({ title: e.target.value })}
                  placeholder="Untitled"
                  className="w-full text-xl font-bold bg-transparent outline-none border-b-2 border-transparent
                             hover:border-border/30 focus:border-primary/40 pb-1 mb-4 transition-colors"
                />

                <div className="space-y-2.5 mb-6">
                  {row.project_id && (
                    <FieldRow icon={Folder} label="Project">
                      <button
                        onClick={goToProject}
                        className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 hover:bg-muted px-2.5 py-1 text-xs font-medium transition-colors"
                      >
                        {projectTitle || "Untitled"}
                        <ExternalLink className="h-3 w-3 text-muted-foreground" />
                      </button>
                    </FieldRow>
                  )}

                  <FieldRow icon={User} label="Assignee">
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 hover:bg-muted pl-1 pr-2.5 py-1 text-xs font-medium transition-colors">
                          <div className="h-5 w-5 rounded-full bg-primary/15 flex items-center justify-center text-[9px] font-semibold text-primary shrink-0">
                            {(assignee?.full_name || "?").charAt(0).toUpperCase()}
                          </div>
                          {assignee?.full_name || "Unassigned"}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-56 p-1" align="start">
                        <div className="max-h-64 overflow-y-auto">
                          {profiles.map((p) => (
                            <button
                              key={p.user_id}
                              onClick={() => updateTask({ assigned_to: p.user_id })}
                              className="w-full flex items-center justify-between gap-2 px-2 py-1.5 text-sm rounded-md hover:bg-accent/60 text-left"
                            >
                              <span className="truncate">{p.full_name || "Unknown"}</span>
                              {row.assigned_to === p.user_id && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                            </button>
                          ))}
                          {row.assigned_to && (
                            <button onClick={() => updateTask({ assigned_to: null })} className="w-full px-2 py-1.5 text-xs text-destructive text-left rounded-md hover:bg-accent/60">
                              Unassign
                            </button>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </FieldRow>

                  <FieldRow icon={Calendar} label="Due date">
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground h-7 px-2 -ml-2 rounded-md hover:bg-accent/50">
                          {row.due_date ? format(new Date(row.due_date + "T00:00:00"), "MMM d, yyyy") : "No due date"}
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
                            ].map((opt) => (
                              <Button key={opt.label} variant="ghost" size="sm" className="h-7 text-xs" onClick={() => updateTask({ due_date: format(opt.date, "yyyy-MM-dd") })}>
                                {opt.label}
                              </Button>
                            ))}
                            {row.due_date && (
                              <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => updateTask({ due_date: null })}>
                                Clear
                              </Button>
                            )}
                          </div>
                          <CalendarComponent
                            mode="single"
                            selected={row.due_date ? new Date(row.due_date + "T00:00:00") : undefined}
                            onSelect={(date) => { if (date) updateTask({ due_date: format(date, "yyyy-MM-dd") }); }}
                            className="p-3 pointer-events-auto"
                          />
                        </div>
                      </PopoverContent>
                    </Popover>
                  </FieldRow>

                  <FieldRow icon={Flag} label="Priority">
                    <PriorityPill value={row.priority || "medium"} size="sm" onChange={(v) => updateTask({ priority: v })} />
                  </FieldRow>

                  <FieldRow icon={CheckCircle2} label="Status">
                    <StatusPill kind="task" value={row.status || "todo"} onChange={(v) => updateTask({ status: v })} />
                  </FieldRow>
                </div>

                {/* Details — transparent by default, subtle fill on focus */}
                <section className="mb-7">
                  <h3 className="text-sm font-semibold text-foreground mb-2">Details</h3>
                  <div
                    className="rounded-md transition-colors focus-within:bg-muted/40"
                    style={{ maxHeight: 180, overflowY: "auto" }}
                  >
                    <RichTextEditor
                      content={row.notes_content || row.description || ""}
                      onChange={(html) => updateTask({ notes_content: html })}
                      placeholder="Add a description, plans, context…"
                      borderless
                    />
                  </div>
                </section>

                {/* Subtasks — count + + inline with heading */}
                <section className="mb-7">
                  <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                    Subtasks
                    {subtasks.length > 0 && (
                      <span className="text-xs font-normal text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded-full">
                        {doneSubtasks}/{subtasks.length}
                      </span>
                    )}
                    <button
                      onClick={() => document.getElementById("task-new-subtask")?.focus()}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </h3>
                  <div className="space-y-1">
                    {subtasks.map((s) => (
                      <div key={s.id} className="flex items-center gap-3 py-1.5 px-2 -mx-2 rounded-md hover:bg-accent/30 group">
                        <Checkbox checked={s.done} onCheckedChange={() => toggleSubtask(s.id)} />
                        <span className={cn("text-sm flex-1", s.done && "line-through text-muted-foreground")}>{s.title}</span>
                        <button className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity" onClick={() => removeSubtask(s.id)}>
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                    <div className="flex gap-2 pt-1">
                      <Input
                        id="task-new-subtask"
                        value={newSubtask}
                        onChange={(e) => setNewSubtask(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && addSubtask()}
                        placeholder="Add a subtask…"
                        className="text-sm h-8 border-dashed"
                      />
                      <Button size="sm" variant="ghost" onClick={addSubtask} disabled={!newSubtask.trim()}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </section>

                {/* Docs — + inline with heading */}
                <section className="mb-7">
                  <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                    Docs
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="text-muted-foreground hover:text-foreground transition-colors">
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64 p-1" align="start">
                        <button
                          onClick={createDoc}
                          disabled={creatingDoc}
                          className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md hover:bg-accent/60 text-left"
                        >
                          {creatingDoc ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                          New doc
                        </button>
                        {projectDocs.filter((d) => !d.linked).length > 0 && (
                          <>
                            <div className="px-2 pt-2 pb-1 text-[10px] uppercase tracking-wide text-muted-foreground">From this project</div>
                            <div className="max-h-48 overflow-y-auto">
                              {projectDocs.filter((d) => !d.linked).map((d) => (
                                <button
                                  key={d.id}
                                  onClick={() => linkExistingDoc(d.id)}
                                  className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md hover:bg-accent/60 text-left"
                                >
                                  <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                  <span className="truncate">{d.title}</span>
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </PopoverContent>
                    </Popover>
                  </h3>
                  {linkedDocs.length > 0 && (
                    <div className="space-y-1.5">
                      {linkedDocs.map((d) => (
                        <div key={d.linkId} className="flex items-center gap-2.5 border border-border/50 rounded-md px-3 py-2 group">
                          <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <button onClick={() => openDoc(d.id)} className="flex-1 min-w-0 text-left text-sm truncate hover:underline">
                            {d.title}
                          </button>
                          <span className="text-[11px] text-muted-foreground shrink-0">{format(new Date(d.updated_at), "MMM d")}</span>
                          <button onClick={() => unlinkDoc(d.linkId)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity shrink-0">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* Attachments — + inline with heading */}
                <section>
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    Attachments
                    <button className="text-muted-foreground hover:text-foreground transition-colors">
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </h3>
                </section>
              </div>

              {/* ── Activity — accent tinted, grows with content ── */}
              <div className="bg-muted/40 border-t border-border/40 mt-2">
                <ActivityPanel entityType="task" entityId={id} inline />
              </div>

            </div>

            {/* ── Composer — always pinned at the very bottom ── */}
            <div className="shrink-0 border-t border-border/40 bg-muted/40 px-3 pt-3 pb-3">
              <ActivityComposer
                submitting={submittingComment}
                onSubmit={handleComment}
                placeholder="Leave a comment…"
              />
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
