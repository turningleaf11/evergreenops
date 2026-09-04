alter table agent_tasks add column goal_id uuid references goals(id) on delete set null;

create index if not exists agent_tasks_goal_id_idx on agent_tasks(goal_id);;
