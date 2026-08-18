import { useState } from "react";
import DataTableView from "@/components/execution/DataTableView";
import TaskPeek from "@/components/mention-peek/peeks/TaskPeek";
import { AgentTaskDetail } from "@/components/execution/AgentTaskDetail";
import CreateEntityDialog, { type AgentMeta } from "@/components/execution/CreateEntityDialog";

interface Props {
  // Merged tasks + agent_tasks rows, each tagged with _kind by the parent.
  items: any[];
  profiles: { user_id: string; full_name: string | null }[];
  agents: AgentMeta[];
  repos: { slug: string; name: string; github_repo: string }[];
  projectId: string;
  onCreate: (data: any) => void;
  onStatusChange: (id: string, kind: "task" | "agent_task", status: string) => void;
  onUpdate: (id: string, kind: "task" | "agent_task", patch: Record<string, any>) => void;
  onChanged?: () => void;
  unreadIds?: Set<string>;
}

const TASK_STATUS_OPTIONS = [
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "blocked", label: "Blocked" },
  { value: "done", label: "Done" },
];

export default function ProjectTasksTab({
  items, profiles, agents, repos, projectId, onCreate, onStatusChange, onUpdate, onChanged, unreadIds,
}: Props) {
  const [peek, setPeek] = useState<{ id: string; kind: "task" | "agent_task" } | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const getName = (uid: string | null) => {
    if (!uid) return "Unassigned";
    const agent = agents.find((a) => a.slug === uid);
    if (agent) return agent.name;
    return profiles.find((p) => p.user_id === uid)?.full_name || "Unknown";
  };

  return (
    <>
      <div className="mb-3">
        <CreateEntityDialog
          title="Add task"
          open={createOpen}
          onOpenChange={setCreateOpen}
          onSubmit={(data) => { onCreate(data); setCreateOpen(false); }}
          type="task"
          goals={[]}
          projects={[]}
          departments={[]}
          profiles={profiles}
          agents={agents}
          repos={repos}
          lockProjectId={projectId}
        />
      </div>

      {/* Same table component the standalone Tasks page uses — one list
          implementation, not a parallel, thinner one. Rows can be `tasks`
          or `agent_tasks`; each keeps its own fields, this just merges the
          columns they share (name/status/priority/assignee/due date). */}
      <DataTableView
        items={items}
        type="task"
        onItemClick={(t) => setPeek({ id: t.id, kind: t._kind })}
        onStatusChange={(id, status) => {
          const item = items.find((i) => i.id === id);
          onStatusChange(id, item?._kind || "task", status);
        }}
        onUpdate={(id, patch) => {
          const item = items.find((i) => i.id === id);
          onUpdate(id, item?._kind || "task", patch);
        }}
        getName={getName}
        statusOptions={TASK_STATUS_OPTIONS}
        profiles={profiles}
        unreadIds={unreadIds}
      />

      {peek?.kind === "task" && (
        <TaskPeek
          id={peek.id}
          open={true}
          onClose={() => { setPeek(null); onChanged?.(); }}
        />
      )}
      {peek?.kind === "agent_task" && (
        <AgentTaskDetail
          taskId={peek.id}
          open={true}
          onClose={() => { setPeek(null); onChanged?.(); }}
        />
      )}
    </>
  );
}
