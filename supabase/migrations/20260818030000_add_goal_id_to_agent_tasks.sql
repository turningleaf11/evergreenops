-- agent_tasks can now carry a direct goal_id link, matching tasks.goal_id.
-- Lets AI-agent work stay visibly tied to a goal even when it isn't routed
-- through a project (mirrors tasks, which already support goal_id
-- independent of project_id).

alter table agent_tasks add column goal_id uuid references goals(id) on delete set null;

create index if not exists agent_tasks_goal_id_idx on agent_tasks(goal_id);
