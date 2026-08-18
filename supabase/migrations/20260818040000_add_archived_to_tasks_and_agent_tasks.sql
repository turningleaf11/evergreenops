-- Tasks and agent_tasks get an archived flag, mirroring projects.archived,
-- so the task/agent-task "..." menu can offer the same Archive action the
-- project header menu already has.

alter table tasks add column archived boolean not null default false;
alter table agent_tasks add column archived boolean not null default false;
