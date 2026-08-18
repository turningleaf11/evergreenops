import TaskPeek from "@/components/mention-peek/peeks/TaskPeek";
import AgentTaskPeek from "@/components/execution/AgentTaskPeek";
import type { WorkItemKind } from "@/hooks/useProjectWorkItems";

// One peek entry point for any work item, task or agent_task. Callers just
// pass the id + kind they clicked — this picks the right detail surface
// (TaskPeek vs AgentTaskPeek) instead of every view reimplementing that
// routing itself. Both are the same components used everywhere else in the
// app a task of that kind opens — no third variant.
export default function WorkItemPeek({
  peek, onClose,
}: {
  peek: { id: string; kind: WorkItemKind } | null;
  onClose: () => void;
}) {
  if (!peek) return null;
  if (peek.kind === "agent_task") {
    return <AgentTaskPeek taskId={peek.id} open onClose={onClose} />;
  }
  return <TaskPeek id={peek.id} open onClose={onClose} />;
}
