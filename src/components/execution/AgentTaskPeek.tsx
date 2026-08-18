import { useEffect, useState, useCallback } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Sparkles, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import ActivityPanel from "@/components/activity/ActivityPanel";
import { StatusPill, PriorityPill } from "@/components/primitives";
import WorkItemMenu from "@/components/execution/WorkItemMenu";

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

// The single AI-task detail surface — used from AI Hub's board and from a
// Project's merged work-item list alike. Fields are the union of what used
// to be two divergent components (a private dialog in AiHubPage.tsx, and an
// earlier unused Sheet draft): Type/Assigned-to/Status/Repo/Followers plus
// Result/Error/Notes and a Comments/AI Log activity rail. Every field
// auto-saves on change, same model as TaskPeek — no staged form.
export default function AgentTaskPeek({ taskId, open, onClose }: { taskId: string; open: boolean; onClose: () => void }) {
  const [task, setTask] = useState<AgentTask | null>(null);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(true);

  const [titleDraft, setTitleDraft] = useState("");
  const [descriptionDraft, setDescriptionDraft] = useState("");

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
    setDescriptionDraft(t.description || "");

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
    setLoading(false);
  }, [taskId]);

  useEffect(() => { if (open && taskId) load(); }, [open, taskId, load]);

  const updateTask = async (patch: Record<string, any>) => {
    if (!task) return;
    setTask({ ...task, ...patch });
    const { error } = await supabase.from("agent_tasks").update(patch).eq("id", task.id);
    if (error) toast.error(error.message);
  };

  const assignee = assignees.find((a) => a.key === task?.assigned_to);
  const followers = task?.followers || [];

  const addFollower = (key: string) => {
    if (!followers.includes(key)) updateTask({ followers: [...followers, key] });
  };
  const removeFollower = (key: string) => updateTask({ followers: followers.filter((f) => f !== key) });

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-[1100px] p-0 overflow-hidden flex flex-col">
        {loading || !task ? (
          <div className="flex items-center gap-2 px-6 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading task…
          </div>
        ) : (
          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* Left main column */}
            <div className="flex-1 min-w-0 flex flex-col overflow-y-auto">
              {/* Header — pr-10 clears the Sheet's own absolute close X (right-4 top-4 z-20). */}
              <div className="px-6 py-5 border-b border-border/40 shrink-0 space-y-4">
                <div className="flex items-center justify-between pr-10">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Sparkles className="h-3.5 w-3.5 text-primary/70" />
                    <span className="font-medium">AI task</span>
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

                <SheetHeader className="text-left">
                  <SheetTitle className="text-left">
                    <input
                      value={titleDraft}
                      onChange={(e) => setTitleDraft(e.target.value)}
                      onBlur={() => titleDraft.trim() && titleDraft !== task.title && updateTask({ title: titleDraft.trim() })}
                      className="w-full text-xl font-bold bg-transparent outline-none border-b-2 border-transparent hover:border-border/30 focus:border-primary/40 pb-1"
                    />
                  </SheetTitle>
                </SheetHeader>

                <div className="flex items-center gap-2 flex-wrap">
                  <StatusPill kind="task" value={task.status} onChange={(v) => updateTask({ status: v })} />
                  <PriorityPill value={task.priority} size="sm" onChange={() => {}} />
                  {task.is_system_task && <span className="text-xs text-muted-foreground">· system</span>}
                </div>
              </div>

              {/* Body */}
              <div className="px-6 py-5 space-y-5">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Type</Label>
                    <Select value={task.type} onValueChange={(v) => updateTask({ type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(["general", "research", "code", "decision", "communication"] as TaskType[]).map((t) => (
                          <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Assigned to</Label>
                    <Select value={task.assigned_to} onValueChange={(v) => updateTask({ assigned_to: v })}>
                      <SelectTrigger>
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
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Repo</Label>
                  <Select value={task.repo ?? "none"} onValueChange={(v) => updateTask({ repo: v === "none" ? null : v })}>
                    <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {repos.map((r) => (
                        <SelectItem key={r.slug} value={r.slug}><span className="font-mono text-sm">{r.github_repo}</span></SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Description</Label>
                  <Textarea
                    value={descriptionDraft}
                    onChange={(e) => setDescriptionDraft(e.target.value)}
                    onBlur={() => descriptionDraft !== (task.description || "") && updateTask({ description: descriptionDraft })}
                    rows={5}
                    className="text-sm whitespace-pre-wrap"
                  />
                </div>

                {/* Followers */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Followers</Label>
                  <div className="flex flex-wrap gap-1.5 mb-1.5">
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
                  </div>
                  <Select value="none" onValueChange={(v) => v !== "none" && addFollower(v)}>
                    <SelectTrigger><span className="text-muted-foreground text-sm">Add follower…</span></SelectTrigger>
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

                {task.notes && (
                  <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Notes from Albus</p>
                    <p className="text-sm leading-relaxed">{task.notes}</p>
                  </div>
                )}

                {task.result && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Result</p>
                    <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto">
                      {cleanResult(task.result)}
                    </div>
                  </div>
                )}

                {task.error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
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
            </div>

            {/* Right rail — Comments + AI Log tabs */}
            <aside className="w-[400px] shrink-0 border-l border-border/40 bg-card/30 flex flex-col overflow-hidden">
              <ActivityPanel entityType="agent_task" entityId={task.id} agentTaskId={task.id} hideHeader />
            </aside>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
