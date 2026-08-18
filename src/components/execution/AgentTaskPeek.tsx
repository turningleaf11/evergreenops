import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Loader2, Sparkles, X, ChevronDown, Folder, Tag, User, CheckCircle2, Flag, Github, Users, ExternalLink,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import ActivityPanel from "@/components/activity/ActivityPanel";
import { ActivityComposer, type ActivitySubmitPayload } from "@/components/activity/ActivityComposer";
import { StatusPill, PriorityPill } from "@/components/primitives";
import WorkItemMenu from "@/components/execution/WorkItemMenu";
import FieldRow from "@/components/execution/FieldRow";
import { cn } from "@/lib/utils";

// Shared with tasks.status — see statusTone.ts TASK registry.
type Status = "backlog" | "todo" | "in_progress" | "blocked" | "review" | "approved" | "done";
type TaskType = "general" | "research" | "code" | "decision" | "communication";

type AgentTask = {
  id: string;
  title: string;
  description: string | null;
  assigned_to: string;
  status: Status;
  priority: string;
  type: TaskType;
  repo: string | null;
  followers: string[] | null;
  result: string | null;
  error: string | null;
  notes: string | null;
  context: Record<string, unknown> | null;
  project_id: string | null;
  created_at: string;
  updated_at: string;
  due_date: string | null;
  started_at: string | null;
  completed_at: string | null;
  is_system_task: boolean;
};

type Assignee = {
  key: string; // slug for agents, user_id for humans
  name: string;
  subtitle: string | null;
  emoji: string | null;
  avatar_url: string | null;
  kind: "agent" | "human";
  accent_color: string | null;
};

type Repo = { slug: string; name: string; github_repo: string };

const AVATAR_COLORS = ["#6366f1", "#f59e0b", "#10b981", "#06b6d4", "#f43f5e", "#a78bfa", "#34d399", "#60a5fa"];
const colorFor = (s: string) => AVATAR_COLORS[Math.abs(s.split("").reduce((a, c) => a + c.charCodeAt(0), 0)) % AVATAR_COLORS.length];
const initials = (name: string) => name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

function AssigneeAvatar({ assignee, size = "sm" }: { assignee: Assignee | undefined; size?: "sm" | "md" }) {
  const sz = size === "sm" ? "h-6 w-6 text-[10px]" : "h-8 w-8 text-xs";
  if (!assignee) return <span className={`flex items-center justify-center rounded-full border border-border bg-secondary text-muted-foreground ${sz}`}>?</span>;
  if (assignee.avatar_url) return <img src={assignee.avatar_url} alt={assignee.name} className={`rounded-full object-cover ${sz}`} />;
  const bg = assignee.accent_color ?? colorFor(assignee.name);
  return (
    <span className={`flex items-center justify-center rounded-full font-semibold text-white ${sz}`} style={{ background: bg }}>
      {assignee.emoji ?? initials(assignee.name)}
    </span>
  );
}

const cleanResult = (raw: string) =>
  raw.replace(/<tool_call>[\s\S]*?<\/tool_call>/g, "")
     .replace(/<tool_response>[\s\S]*?<\/tool_response>/g, "")
     .replace(/^\s*\n/gm, "")
     .trim();

// Visual match for CollapsibleNotes (src/components/primitives/CollapsibleNotes.tsx)
// but plain text, not TipTap/HTML — agent_tasks.description is read as literal
// text by backend workers (jr-coder-worker's Claude prompt, trigger-github-task's
// workflow input), so it can't become rich text without leaking HTML into both.
function PlainDetails({ value, onCommit, placeholder }: { value: string; onCommit: (v: string) => void; placeholder: string }) {
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  return (
    <div className="rounded-xl border border-border/50 bg-card/40 p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Details</h4>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {expanded ? "Collapse" : "Expand"}
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")} />
        </button>
      </div>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => draft !== value && onCommit(draft)}
        placeholder={placeholder}
        className={cn(
          "w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground/60 transition-[height]",
          expanded ? "h-[480px]" : "h-[140px]",
        )}
      />
    </div>
  );
}

// The single AI-task detail surface — used from AI Hub's board and from a
// Project's merged work-item list alike. Same shell as TaskPeek: one
// scrolling column with fields stacked via FieldRow, a pinned composer at
// the bottom (not inside the scroll area — matches TaskPeek exactly, and
// ActivityPanel's inline mode never owns a composer, by design).
export default function AgentTaskPeek({ taskId, open, onClose }: { taskId: string; open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [task, setTask] = useState<AgentTask | null>(null);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [repos, setRepos] = useState<Repo[]>([]);
  const [projectTitle, setProjectTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [submittingComment, setSubmittingComment] = useState(false);

  const [titleDraft, setTitleDraft] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [taskRes, agentsRes, profilesRes, reposRes] = await Promise.all([
      supabase.from("agent_tasks").select("*").eq("id", taskId).single(),
      supabase.from("agents").select("slug, name, emoji, avatar_url, subtitle, role, accent_color"),
      supabase.from("profiles").select("user_id, full_name, avatar_url"),
      supabase.from("repos").select("slug, name, github_repo").eq("active", true),
    ]);
    if (taskRes.error) { toast.error(taskRes.error.message); setLoading(false); return; }
    const t = taskRes.data as any;
    setTask(t);
    setTitleDraft(t.title);

    const agentList: Assignee[] = (agentsRes.data || []).map((a: any) => ({
      key: a.slug, name: a.name, subtitle: a.subtitle ?? a.role, emoji: a.emoji,
      avatar_url: a.avatar_url, kind: "agent" as const, accent_color: a.accent_color,
    }));
    const humanList: Assignee[] = (profilesRes.data || []).map((p: any) => ({
      key: p.user_id, name: p.full_name ?? "Human", subtitle: "Team member", emoji: null,
      avatar_url: p.avatar_url, kind: "human" as const, accent_color: null,
    }));
    setAssignees([...agentList, ...humanList]);
    setRepos((reposRes.data || []) as Repo[]);

    if (t.project_id) {
      const { data: proj } = await supabase.from("projects").select("title").eq("id", t.project_id).maybeSingle();
      setProjectTitle(proj?.title || "");
    } else {
      setProjectTitle("");
    }

    setLoading(false);
  }, [taskId]);

  useEffect(() => { if (open && taskId) load(); }, [open, taskId, load]);

  const updateTask = async (patch: Record<string, any>) => {
    if (!task) return;
    setTask({ ...task, ...patch });
    const { error } = await supabase.from("agent_tasks").update(patch).eq("id", task.id);
    if (error) toast.error(error.message);
  };

  const goToProject = () => {
    if (!task?.project_id) return;
    navigate(`/projects/${task.project_id}`);
    onClose();
  };

  // Mirrors TaskPeek's own handleComment (it doesn't route through
  // ActivityPanel's internal submit either) — plus the @mention-agent
  // feedback trigger, moved here since ActivityPanel's inline mode never
  // owns a composer. Uses "blocked" for the status update: ActivityPanel's
  // old inline branch used "pending", a value the 7-stage taxonomy no
  // longer accepts.
  const handleComment = async (payload: ActivitySubmitPayload) => {
    if (!task) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setSubmittingComment(true);
    await supabase.from("comments").insert({
      entity_type: "agent_task", entity_id: task.id,
      author_id: user.id,
      content: payload.contentText,
      content_html: payload.contentHtml,
      parent_id: null,
      attachments: payload.attachments as any,
      mentions: payload.mentions as any,
      gif_url: payload.gifUrl,
      audio_url: payload.audioUrl,
    } as any);

    const mentionsAgent = /@\w+/.test(payload.contentText || "");
    if (mentionsAgent) {
      const { data: agentTask } = await supabase.from("agent_tasks").select("context").eq("id", task.id).maybeSingle();
      const existingFeedback = Array.isArray((agentTask?.context as any)?.human_feedback) ? (agentTask!.context as any).human_feedback : [];
      const newContext = {
        ...(agentTask?.context || {}),
        human_feedback: [...existingFeedback, { at: new Date().toISOString(), text: payload.contentText || "" }],
      };
      await supabase.from("agent_tasks").update({ context: newContext, status: "blocked" }).eq("id", task.id);
      setTask((t) => (t ? { ...t, status: "blocked" } : t));
    }

    setSubmittingComment(false);
  };

  const assignee = assignees.find((a) => a.key === task?.assigned_to);
  const followers = task?.followers || [];

  const addFollower = (key: string) => {
    if (!followers.includes(key)) updateTask({ followers: [...followers, key] });
  };
  const removeFollower = (key: string) => updateTask({ followers: followers.filter((f) => f !== key) });

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-[680px] p-0 overflow-hidden flex flex-col">
        {loading || !task ? (
          <div className="flex items-center gap-2 px-6 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading task…
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto">
              {/* Action bar — pr-14 clears the Sheet's own absolute close X (right-4 top-4 z-20), same as TaskPeek. */}
              <div className="flex items-center justify-between px-5 pt-4 pb-1 pr-14">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5 text-primary/70" />
                  <span className="font-medium">AI task</span>
                  {task.is_system_task && <span>· system</span>}
                </div>
                <WorkItemMenu
                  id={task.id}
                  kind="agent_task"
                  title={task.title}
                  onDuplicated={onClose}
                  onArchived={onClose}
                  onDeleted={onClose}
                  onMoved={onClose}
                />
              </div>

              {/* Title + fields */}
              <div className="px-5 pt-2 pb-5">
                <input
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onBlur={() => titleDraft.trim() && titleDraft !== task.title && updateTask({ title: titleDraft.trim() })}
                  placeholder="Untitled"
                  className="w-full text-xl font-bold bg-transparent outline-none border-b-2 border-transparent
                             hover:border-border/30 focus:border-primary/40 pb-1 mb-4 transition-colors"
                />

                <div className="space-y-2.5 mb-6">
                  {task.project_id && (
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

                  <FieldRow icon={Tag} label="Type">
                    <Select value={task.type} onValueChange={(v) => updateTask({ type: v })}>
                      <SelectTrigger className="h-8 text-xs w-auto min-w-[140px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(["general", "research", "code", "decision", "communication"] as TaskType[]).map((t) => (
                          <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FieldRow>

                  <FieldRow icon={User} label="Assigned to">
                    <Select value={task.assigned_to} onValueChange={(v) => updateTask({ assigned_to: v })}>
                      <SelectTrigger className="h-8 text-xs w-auto min-w-[160px]">
                        <div className="flex items-center gap-2">
                          <AssigneeAvatar assignee={assignee} size="sm" />
                          <span className="truncate">{assignee?.name ?? task.assigned_to}</span>
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        {assignees.filter((a) => a.kind === "agent").length > 0 && (
                          <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">Agents</div>
                        )}
                        {assignees.filter((a) => a.kind === "agent").map((a) => (
                          <SelectItem key={a.key} value={a.key}>
                            <div className="flex items-center gap-2"><AssigneeAvatar assignee={a} size="sm" /><span>{a.name}</span></div>
                          </SelectItem>
                        ))}
                        {assignees.filter((a) => a.kind === "human").length > 0 && (
                          <div className="px-2 py-1 text-xs font-semibold text-muted-foreground mt-1">People</div>
                        )}
                        {assignees.filter((a) => a.kind === "human").map((a) => (
                          <SelectItem key={a.key} value={a.key}>
                            <div className="flex items-center gap-2"><AssigneeAvatar assignee={a} size="sm" /><span>{a.name}</span></div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FieldRow>

                  <FieldRow icon={CheckCircle2} label="Status">
                    <StatusPill kind="task" value={task.status} onChange={(v) => updateTask({ status: v })} />
                  </FieldRow>

                  <FieldRow icon={Flag} label="Priority">
                    <PriorityPill value={task.priority} size="sm" onChange={(v) => updateTask({ priority: v })} />
                  </FieldRow>

                  <FieldRow icon={Github} label="Repo">
                    <Select value={task.repo ?? "none"} onValueChange={(v) => updateTask({ repo: v === "none" ? null : v })}>
                      <SelectTrigger className="h-8 text-xs w-auto min-w-[140px]"><SelectValue placeholder="None" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {repos.map((r) => (
                          <SelectItem key={r.slug} value={r.slug}><span className="font-mono text-xs">{r.github_repo}</span></SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FieldRow>

                  <FieldRow icon={Users} label="Followers">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {followers.map((key) => {
                        const f = assignees.find((a) => a.key === key);
                        if (!f) return null;
                        return (
                          <span key={key} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary pl-1 pr-2 py-0.5 text-xs">
                            <AssigneeAvatar assignee={f} size="sm" />
                            <span className="font-medium">{f.name}</span>
                            <button onClick={() => removeFollower(key)} className="ml-0.5 text-muted-foreground hover:text-foreground transition-colors">
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        );
                      })}
                      <Select value="none" onValueChange={(v) => v !== "none" && addFollower(v)}>
                        <SelectTrigger className="h-7 w-7 p-0 border-dashed [&>svg]:hidden justify-center">
                          <span className="text-muted-foreground text-base leading-none">+</span>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none" className="text-muted-foreground">Add follower…</SelectItem>
                          {assignees.filter((a) => a.key !== task.assigned_to && !followers.includes(a.key)).map((a) => (
                            <SelectItem key={a.key} value={a.key}>
                              <div className="flex items-center gap-2"><AssigneeAvatar assignee={a} size="sm" /><span>{a.name}</span></div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </FieldRow>
                </div>

                {/* Details — visual match for CollapsibleNotes, plain text (see PlainDetails). */}
                <section className="mb-7">
                  <PlainDetails
                    value={task.description || ""}
                    onCommit={(v) => updateTask({ description: v })}
                    placeholder="Add a description, plans, context…"
                  />
                </section>

                {task.notes && (
                  <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 mb-5">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Notes from Albus</p>
                    <p className="text-sm leading-relaxed">{task.notes}</p>
                  </div>
                )}

                {task.result && (
                  <div className="mb-5">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Result</p>
                    <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto">
                      {cleanResult(task.result)}
                    </div>
                  </div>
                )}

                {task.error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 mb-5">
                    <p className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-1">Error</p>
                    <p className="text-sm text-red-700">{task.error}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground pt-1 border-t border-border">
                  <div>Created · {format(parseISO(task.created_at), "MMM d, h:mm a")}</div>
                  {task.due_date && <div>Due · {format(parseISO(task.due_date), "MMM d")}</div>}
                  {task.started_at && <div>Started · {format(parseISO(task.started_at), "MMM d, h:mm a")}</div>}
                  {task.completed_at && <div>Completed · {format(parseISO(task.completed_at), "MMM d, h:mm a")}</div>}
                </div>
              </div>

              {/* Activity — same flowing, single-scroll placement TaskPeek uses. */}
              <div className="bg-muted/40 border-t border-border/40 mt-2">
                <ActivityPanel entityType="agent_task" entityId={task.id} agentTaskId={task.id} inline />
              </div>
            </div>

            {/* Composer — always pinned at the very bottom, sibling of the scroll area (same as TaskPeek). */}
            <div className="shrink-0 border-t border-border/40 bg-muted/40 px-3 pt-3 pb-3">
              <ActivityComposer
                submitting={submittingComment}
                onSubmit={handleComment}
                placeholder="Comment or @mention an agent to activate them…"
              />
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
