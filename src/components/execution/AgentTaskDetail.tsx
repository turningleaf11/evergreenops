import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { AgentActivityDrillDown } from "@/components/ai-hub/AgentActivityDrillDown";

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
  created_at: string;
  updated_at: string;
  is_system_task: boolean;
};

const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: "backlog", label: "Backlog" },
  { value: "pending", label: "To do" },
  { value: "doing", label: "In progress" },
  { value: "review", label: "Albus reviewing" },
  { value: "approved", label: "Albus reviewing (approved)" },
  { value: "needs_input", label: "Needs your input" },
  { value: "done", label: "Done" },
  { value: "cancelled", label: "Cancelled" },
];

const cleanResult = (raw: string) =>
  raw.replace(/<tool_call>[\s\S]*?<\/tool_call>/g, "")
     .replace(/<tool_response>[\s\S]*?<\/tool_response>/g, "")
     .replace(/^\s*\n/gm, "")
     .trim();

/**
 * Detail view for an AI-assigned task in the unified Execution Hub board.
 * Mirrors the human TaskPeek pattern: click in, see the brief, change status.
 * The "Agent log" tab reuses AgentActivityDrillDown scoped to this task as
 * its own dense lane, separate from the plain details view.
 */
export function AgentTaskDetail({ taskId, open, onClose }: { taskId: string; open: boolean; onClose: () => void }) {
  const [task, setTask] = useState<AgentTask | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchTask = async () => {
    const { data, error } = await supabase.from("agent_tasks").select("*").eq("id", taskId).single();
    if (error) toast.error(error.message);
    else setTask(data as any);
    setLoading(false);
  };

  useEffect(() => { setLoading(true); fetchTask(); }, [taskId]);

  const updateStatus = async (status: Status) => {
    if (!task) return;
    setSaving(true);
    const { error } = await supabase.from("agent_tasks").update({ status }).eq("id", task.id);
    if (error) toast.error(error.message);
    else { setTask({ ...task, status }); toast.success("Status updated"); }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        {loading || !task ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading…
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className="flex items-center justify-center h-6 w-6 rounded-full bg-[#7F77DD] text-white shrink-0">
                  <Sparkles className="h-3.5 w-3.5" />
                </span>
                <span className="leading-snug">{task.title}</span>
              </DialogTitle>
            </DialogHeader>

            <Tabs defaultValue="details">
              <TabsList>
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="log">Agent log</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-4 mt-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Assigned to</Label>
                    <p className="text-sm">{task.assigned_to}{task.is_system_task && " · system"}</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Status</Label>
                    <Select value={task.status} onValueChange={(v) => updateStatus(v as Status)} disabled={saving}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {task.description && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Description</p>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{task.description}</p>
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
              </TabsContent>

              <TabsContent value="log" className="mt-3">
                <AgentActivityDrillDown taskId={task.id} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
