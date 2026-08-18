import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import ActivityPanel from "@/components/activity/ActivityPanel";
import { StatusPill } from "@/components/primitives";
import WorkItemMenu from "@/components/execution/WorkItemMenu";

type Status = "backlog" | "pending" | "doing" | "review" | "approved" | "needs_input" | "done" | "cancelled";

type AgentTask = {
  id: string;
  title: string;
  description: string | null;
  assigned_to: string;
  status: Status;
  priority: string;
  result: string | null;
  error: string | null;
  notes: string | null;
  context: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  is_system_task: boolean;
};

const cleanResult = (raw: string) =>
  raw.replace(/<tool_call>[\s\S]*?<\/tool_call>/g, "")
     .replace(/<tool_response>[\s\S]*?<\/tool_response>/g, "")
     .replace(/^\s*\n/gm, "")
     .trim();

/**
 * Detail view for an AI-assigned task. Shares the same Sheet shell, header
 * layout, and StatusBadge as the human TaskPeek (src/components/mention-peek/peeks/TaskPeek.tsx)
 * so an agent task doesn't feel like a different product from a human one.
 * Human feedback is sent by @mentioning the agent in the Comments tab
 * (ActivityPanel writes it into context.human_feedback and wakes the worker).
 */
export function AgentTaskDetail({ taskId, open, onClose }: { taskId: string; open: boolean; onClose: () => void }) {
  const [task, setTask] = useState<AgentTask | null>(null);
  const [agentName, setAgentName] = useState<string | null>(null);
  const [agentMeta, setAgentMeta] = useState<{ emoji: string | null; accent_color: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const fetchTask = async () => {
    const { data, error } = await supabase.from("agent_tasks").select("*").eq("id", taskId).single();
    if (error) { toast.error(error.message); setLoading(false); return; }
    const t = data as any;
    setTask(t);
    setEditTitle(t.title);
    setEditDescription(t.description || "");
    setLoading(false);

    const { data: agent } = await supabase.from("agents").select("name, emoji, accent_color").eq("slug", t.assigned_to).maybeSingle();
    setAgentName(agent?.name || null);
    setAgentMeta(agent ? { emoji: agent.emoji, accent_color: agent.accent_color } : null);
  };

  useEffect(() => { setLoading(true); fetchTask(); }, [taskId]);

  const hasEdits = task && (editTitle !== task.title || editDescription !== (task.description || ""));

  const saveEdits = async () => {
    if (!task || !editTitle.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("agent_tasks")
      .update({ title: editTitle.trim(), description: editDescription })
      .eq("id", task.id);
    if (error) toast.error(error.message);
    else { setTask({ ...task, title: editTitle.trim(), description: editDescription }); toast.success("Saved"); }
    setSaving(false);
  };

  const updateStatus = async (status: Status) => {
    if (!task) return;
    setSaving(true);
    const { error } = await supabase.from("agent_tasks").update({ status }).eq("id", task.id);
    if (error) toast.error(error.message);
    else { setTask({ ...task, status }); toast.success("Status updated"); }
    setSaving(false);
  };

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-[1100px] p-0 overflow-hidden flex flex-col">
        {loading || !task ? (
          <div className="flex items-center gap-2 px-6 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading task…
          </div>
        ) : (
          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* Left main column */}
            <div className="flex-1 min-w-0 flex flex-col overflow-y-auto">
              {/* Header */}
              <div className="px-6 py-5 border-b border-border/40 shrink-0 space-y-4">
                <div className="flex items-center justify-between">
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

                <SheetHeader>
                  <SheetTitle className="text-xl text-left">{task.title}</SheetTitle>
                </SheetHeader>

                <div className="flex items-center gap-2 flex-wrap">
                  <StatusPill kind="task" value={task.status} onChange={v => !saving && updateStatus(v as Status)} />
                </div>
              </div>

              {/* Body */}
              <div className="px-6 py-5 space-y-4">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex items-center justify-center h-6 w-6 rounded-full ring-2 ring-background text-white text-[11px] shrink-0"
                    style={{ background: agentMeta?.accent_color || "#7F77DD" }}
                  >
                    {agentMeta?.emoji ?? <User className="h-3 w-3" />}
                  </span>
                  <span className="text-sm font-medium">{agentName || task.assigned_to}</span>
                  {task.is_system_task && <span className="text-xs text-muted-foreground">· system</span>}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Title</Label>
                  <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} disabled={saving} />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Description</Label>
                  <Textarea
                    value={editDescription}
                    onChange={e => setEditDescription(e.target.value)}
                    rows={5}
                    disabled={saving}
                    className="text-sm whitespace-pre-wrap"
                  />
                </div>

                {hasEdits && (
                  <div className="flex justify-end">
                    <Button size="sm" onClick={saveEdits} disabled={saving || !editTitle.trim()}>
                      {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />} Save changes
                    </Button>
                  </div>
                )}

                {task.status === "needs_input" && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#991B1B" }}>
                      This task needs your input
                    </p>
                    <p className="text-xs text-red-700/80 mt-1">
                      @mention {agentName || task.assigned_to} in the comments to send context and wake them up.
                    </p>
                  </div>
                )}

                {task.notes && (
                  <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Notes from Albus</p>
                    <p className="text-sm leading-relaxed">{task.notes}</p>
                  </div>
                )}

                {task.result && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Result</p>
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

                <p className="text-xs text-muted-foreground pt-1 border-t border-border">
                  Created {format(parseISO(task.created_at), "MMM d, h:mm a")} · Updated {format(parseISO(task.updated_at), "MMM d, h:mm a")}
                </p>
              </div>
            </div>

            {/* Right rail — Comments + AI Log tabs */}
            <aside className="w-[400px] shrink-0 border-l border-border/40 bg-card/30 flex flex-col overflow-hidden">
              <ActivityPanel
                entityType="agent_task"
                entityId={task.id}
                agentTaskId={task.id}
                hideHeader
              />
            </aside>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
