\pset pager off
\set ON_ERROR_STOP 0
insert into workspaces (id) values ('11111111-1111-1111-1111-111111111111');
insert into agents (name, slug, emoji, enabled) values
  ('Marquetta','marquetta','🎯',true), ('Cash','cash','💰',true);
insert into agent_tasks (title, assigned_to, status, priority, workspace_id, type) values
  ('Draft this week deal post','marquetta','todo','high','11111111-1111-1111-1111-111111111111','content_draft'),
  ('Capture seeds','marquetta','todo','medium','11111111-1111-1111-1111-111111111111','content_capture'),
  ('Underwrite 1109 Riviera','cash','todo','urgent','11111111-1111-1111-1111-111111111111','underwriting');

\echo '--- 1. claim returns highest-priority marquetta task only ---'
select title, task_type from agent_task_claim_next('marquetta','11111111-1111-1111-1111-111111111111');

\echo '--- 2. cash task is NOT visible to marquetta (urgent, but not hers) ---'
select count(*) as cash_tasks_claimed_by_marquetta from agent_tasks
 where assigned_to='cash' and leased_by='marquetta';

\echo '--- 3. second claim gets the OTHER task, never the same one ---'
select title from agent_task_claim_next('marquetta','11111111-1111-1111-1111-111111111111');

\echo '--- 4. no work left -> zero rows, not an error ---'
select count(*) as rows_when_queue_empty from agent_task_claim_next('marquetta','11111111-1111-1111-1111-111111111111');

\echo '--- 5. submit review works and writes ai_logs ---'
select agent_task_submit_result('marquetta','11111111-1111-1111-1111-111111111111',
  (select id from agent_tasks where title='Capture seeds'), 'Captured 4 seeds from closed deals.');
select status, (result is not null) as has_result, (leased_by is null) as lease_released
  from agent_tasks where title='Capture seeds';
select count(*) as ai_log_rows from ai_logs;

\echo '--- 6. STATUS CEILING: approved is refused (expect ERROR) ---'
select agent_task_submit_result('marquetta','11111111-1111-1111-1111-111111111111',
  (select id from agent_tasks where title='Draft this week deal post'), 'done', 'approved');

\echo '--- 6b. done is refused too (expect ERROR) ---'
select agent_task_submit_result('marquetta','11111111-1111-1111-1111-111111111111',
  (select id from agent_tasks where title='Draft this week deal post'), 'done', 'done');

\echo '--- 7. one agent cannot close another agent task (expect ERROR) ---'
select agent_task_submit_result('cash','11111111-1111-1111-1111-111111111111',
  (select id from agent_tasks where title='Draft this week deal post'), 'sniped');

\echo '--- 8. empty result refused (expect ERROR) ---'
select agent_task_submit_result('marquetta','11111111-1111-1111-1111-111111111111',
  (select id from agent_tasks where title='Draft this week deal post'), '   ');

\echo '--- 9. disabled agent claims nothing (kill switch) ---'
update agents set enabled=false where slug='marquetta';
insert into agent_tasks (title, assigned_to, status, priority, workspace_id)
values ('Post-disable task','marquetta','todo','high','11111111-1111-1111-1111-111111111111');
select count(*) as claims_while_disabled from agent_task_claim_next('marquetta','11111111-1111-1111-1111-111111111111');
update agents set enabled=true where slug='marquetta';

\echo '--- 10. unknown agent refused (expect ERROR) ---'
select count(*) from agent_task_claim_next('impostor','11111111-1111-1111-1111-111111111111');

\echo '--- 11. wrong workspace sees nothing ---'
insert into workspaces (id) values ('22222222-2222-2222-2222-222222222222');
select count(*) as claims_in_other_workspace from agent_task_claim_next('marquetta','22222222-2222-2222-2222-222222222222');

\echo '--- 12. expired lease is reclaimable ---'
update agent_tasks set leased_until = now() - interval '1 hour'
 where title='Draft this week deal post';
select title from agent_task_claim_next('marquetta','11111111-1111-1111-1111-111111111111');
