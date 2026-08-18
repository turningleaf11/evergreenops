import { useState } from "react";
import DataTableView from "@/components/execution/DataTableView";
import CreateEntityDialog, { type AgentMeta, type ExistingCandidate } from "@/components/execution/CreateEntityDialog";

interface Props {
  // Merged tasks + agent_tasks rows, each tagged with _kind by useProjectWorkItems.
  items: any[];
  profiles: { user_id: string; full_name: string | null }[];
  agents: AgentMeta[];
  repos: { slug: string; name: string; github_repo: string }[];
  projectId: string;
  getName: (uid: string | null) => string;
  onCreate: (data: any) => void;
  onItemClick: (item: any) => void;
  onStatusChange: (id: string, status: string) => void;
  onUpdate: (id: string, patch: Record<string, any>) => void;
  existingCandidates: ExistingCandidate[];
  onLinkExisting: (candidate: ExistingCandidate) => void;
  unreadIds?: Set<string>;
}

const TASK_STATUS_OPTIONS = [
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "blocked", label: "Blocked" },
  { value: "done", label: "Done" },
];

export default function ProjectTasksTab({
  items, profiles, agents, repos, projectId, getName, onCreate, onItemClick, onStatusChange, onUpdate,
  existingCandidates, onLinkExisting, unreadIds,
}: Props) {
  const [createOpen, setCreateOpen] = useState(false);

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
          existingCandidates={existingCandidates}
          onLinkExisting={(c) => { onLinkExisting(c); setCreateOpen(false); }}
        />
      </div>

      {/* Same table component the standalone Tasks page uses — one list
          implementation, not a parallel, thinner one. Rows can be `tasks`
          or `agent_tasks`; each keeps its own fields, this just merges the
          columns they share (name/status/priority/assignee/due date). */}
      <DataTableView
        items={items}
        type="task"
        onItemClick={onItemClick}
        onStatusChange={onStatusChange}
        onUpdate={onUpdate}
        getName={getName}
        statusOptions={TASK_STATUS_OPTIONS}
        profiles={profiles}
        unreadIds={unreadIds}
      />
    </>
  );
}
