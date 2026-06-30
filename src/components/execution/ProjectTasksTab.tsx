import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import DataTableView from "@/components/execution/DataTableView";
import TaskPeek from "@/components/mention-peek/peeks/TaskPeek";

interface Props {
  tasks: any[];
  profiles: { user_id: string; full_name: string | null }[];
  onCreate: (title: string) => void;
  onStatusChange: (taskId: string, status: string) => void;
  onChanged?: () => void;
}

const TASK_STATUS_OPTIONS = [
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "blocked", label: "Blocked" },
  { value: "done", label: "Done" },
];

export default function ProjectTasksTab({ tasks, profiles, onCreate, onStatusChange, onChanged }: Props) {
  const [newTitle, setNewTitle] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [peekTaskId, setPeekTaskId] = useState<string | null>(null);

  const getName = (uid: string | null) =>
    !uid ? "Unassigned" : profiles.find((p) => p.user_id === uid)?.full_name || "Unknown";

  const submit = () => {
    if (!newTitle.trim()) return;
    onCreate(newTitle.trim());
    setNewTitle("");
    setAddOpen(false);
  };

  const updateTask = async (id: string, patch: Record<string, any>) => {
    const { error } = await supabase.from("tasks").update(patch).eq("id", id);
    if (error) toast.error(error.message);
    else onChanged?.();
  };

  return (
    <>
      <div className="mb-3">
        <Popover open={addOpen} onOpenChange={setAddOpen}>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline">
              <Plus className="h-3.5 w-3.5 mr-1" /> Add task
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-2" align="start">
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="Task name…"
              autoFocus
              className="text-sm h-8"
            />
            <div className="flex justify-end mt-2">
              <Button size="sm" onClick={submit} disabled={!newTitle.trim()}>Add</Button>
            </div>
          </PopoverContent>
        </Popover>
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
