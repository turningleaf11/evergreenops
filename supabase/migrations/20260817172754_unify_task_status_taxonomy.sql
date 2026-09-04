alter table agent_tasks drop constraint if exists agent_tasks_status_check;

update agent_tasks set status = 'todo' where status = 'pending';
update agent_tasks set status = 'in_progress' where status = 'doing';
update agent_tasks set status = 'blocked' where status = 'needs_input';

delete from agent_tasks where status = 'cancelled';
delete from tasks where status = 'cancelled';

alter table agent_tasks add constraint agent_tasks_status_check
  check (status = any (array['backlog', 'todo', 'in_progress', 'blocked', 'review', 'approved', 'done']));;
