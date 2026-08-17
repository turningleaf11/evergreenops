-- Collapse tasks.status and agent_tasks.status onto one shared, literal
-- 7-stage taxonomy: backlog, todo, in_progress, blocked, review, approved,
-- done. No bucketing/synonym layer — a status value is always a real board
-- column now. Cancelled tasks are deleted rather than kept as a stage.

alter table agent_tasks drop constraint if exists agent_tasks_status_check;

update agent_tasks set status = 'todo' where status = 'pending';
update agent_tasks set status = 'in_progress' where status = 'doing';
update agent_tasks set status = 'blocked' where status = 'needs_input';

delete from agent_tasks where status = 'cancelled';
delete from tasks where status = 'cancelled';

alter table agent_tasks add constraint agent_tasks_status_check
  check (status = any (array['backlog', 'todo', 'in_progress', 'blocked', 'review', 'approved', 'done']));

-- agent_tasks.priority used "normal" where the app-wide priority scale
-- (statusTone.ts PRIORITY registry / PriorityPill) uses "medium" — align
-- so PriorityPill renders a real tone instead of falling back to neutral.
update agent_tasks set priority = 'medium' where priority = 'normal';
