import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import DataTableView from "@/components/execution/DataTableView";
import TaskPeek from "@/components/mention-peek/peeks/TaskPeek";
import { QuickAddPopover } from "@/components/primitives";

interface Props {
  tasks: any[];
  profiles: { user_id: string; full_name: string | null }[];
  onCreate: (title: string) => void;
  onStatusChange: (taskId: string, status: string) => void;
  onChanged?: () => void;
  unreadIds?: Set<string>;
}

const TASK_STATUS_OPTIONS = [
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "blocked", label: "Blocked" },
  { value: "done", label: "Done" },
];

export default function ProjectTasksTab({ tasks, profiles, onCreate, onStatusChange, onChanged, unreadIds }: Props) {
  const [peekTaskId, setPeekTaskId] = useState<string | null>(null);

  const getName = (uid: string | null) =>
    !uid ? "Unassigned" : profiles.find((p) => p.user_id === uid)?.full_name || "Unknown";

  const updateTask = async (id: string, patch: Record<string, any>) => {
    const { error } = await supabase.from("tasks").update(patch).eq("id", id);
    if (error) toast.error(error.message);
    else onChanged?.();
  };

  return (
    <>
      <div className="mb-3">
        <QuickAddPopover triggerLabel="Add task" placeholder="Task name…" onAdd={onCreate} />
      </div>

      {/* Same table component the standalone Tasks page uses — one list
          implementation, not a parallel, thinner one. */}
      <DataTableView
        items={tasks}
        type="task"
        onItemClick={(t) => setPeekTaskId(t.id)}
        onStatusChange={onStatusChange}
        onUpdate={updateTask}
        getName={getName}
        statusOptions={TASK_STATUS_OPTIONS}
        profiles={profiles}
        unreadIds={unreadIds}
      />

      {peekTaskId && (
        <TaskPeek
          id={peekTaskId}
          open={!!peekTaskId}
          onClose={() => { setPeekTaskId(null); onChanged?.(); }}
        />
      )}
    </>
  );
}
