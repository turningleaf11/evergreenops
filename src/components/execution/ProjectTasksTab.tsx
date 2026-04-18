import { useState } from "react";
import { CheckCircle2, Circle, Clock, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import DetailDrawer from "@/components/DetailDrawer";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Props {
  tasks: any[];
  profiles: { user_id: string; full_name: string | null }[];
  onCreate: (title: string) => void;
  onStatusChange: (taskId: string, status: string) => void;
  onChanged?: () => void;
}

const priorityDot: Record<string, string> = {
  urgent: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-green-500",
};

export default function ProjectTasksTab({ tasks, profiles, onCreate, onStatusChange, onChanged }: Props) {
  const [newTitle, setNewTitle] = useState("");
  const [drawerTask, setDrawerTask] = useState<any>(null);

  const getInitials = (uid: string | null) => {
    if (!uid) return "—";
    const name = profiles.find((p) => p.user_id === uid)?.full_name || "U";
    return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  };

  const getName = (uid: string | null) =>
    !uid ? "Unassigned" : profiles.find((p) => p.user_id === uid)?.full_name || "Unknown";

  const cycleStatus = (e: React.MouseEvent, t: any) => {
    e.stopPropagation();
    const next = t.status === "done" ? "not_started" : t.status === "in_progress" ? "done" : "in_progress";
    onStatusChange(t.id, next);
  };

  const submit = () => {
    if (!newTitle.trim()) return;
    onCreate(newTitle.trim());
    setNewTitle("");
  };

  return (
    <>
      <div className="space-y-1">
        {tasks.map((t) => (
          <div
            key={t.id}
            className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-muted/40 cursor-pointer group"
            onClick={() => setDrawerTask(t)}
          >
            <button onClick={(e) => cycleStatus(e, t)} className="shrink-0">
              {t.status === "done" ? (
                <CheckCircle2 className="h-4 w-4 text-primary" />
              ) : t.status === "in_progress" ? (
                <Clock className="h-4 w-4 text-primary/70" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground hover:text-foreground" />
              )}
            </button>
            <span className={`flex-1 min-w-0 truncate text-sm ${t.status === "done" ? "line-through text-muted-foreground" : ""}`}>
              {t.title}
            </span>
            <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${priorityDot[t.priority] || "bg-muted"}`} />
            <span className="text-[11px] text-muted-foreground shrink-0 w-8 text-center">{getInitials(t.assigned_to)}</span>
            <span className="text-[11px] text-muted-foreground shrink-0 w-14 text-right">
              {t.due_date ? format(new Date(t.due_date + "T00:00:00"), "MMM d") : ""}
            </span>
          </div>
        ))}
        <div className="flex gap-2 pt-3">
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Add a task…"
            className="text-sm h-8 border-dashed bg-transparent"
          />
          <Button size="sm" variant="ghost" onClick={submit} disabled={!newTitle.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {tasks.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">No tasks yet.</p>
        )}
      </div>

      <DetailDrawer
        open={!!drawerTask}
        onOpenChange={(o) => { if (!o) setDrawerTask(null); }}
        type="task"
        item={drawerTask}
        getName={getName}
        onStatusChange={async (status) => {
          if (!drawerTask) return;
          await onStatusChange(drawerTask.id, status);
          setDrawerTask((p: any) => p ? { ...p, status } : null);
        }}
        onTitleChange={async (title) => {
          if (!drawerTask) return;
          const { error } = await supabase.from("tasks").update({ title }).eq("id", drawerTask.id);
          if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
          setDrawerTask((p: any) => p ? { ...p, title } : null);
          onChanged?.();
        }}
      />
    </>
  );
}
