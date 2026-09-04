alter table tasks add column archived boolean not null default false;
alter table agent_tasks add column archived boolean not null default false;;
