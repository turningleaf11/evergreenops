-- Collapse Milestones into Deliverables as a flag rather than a parallel
-- table. Every real-world tool surveyed (Asana, ClickUp, EOS, Linear) treats
-- a milestone as a checkpoint belonging to something else, never a fully
-- independent parallel list — and ClickUp specifically models it as a task
-- flagged as a milestone, not a separate object. We already have a real
-- "checklist item with owner/status/due date" table (business_plan_deliverables)
-- — a milestone is just one of those, marked as a launch checkpoint.

alter table public.business_plan_deliverables
  add column if not exists is_milestone boolean not null default false;

insert into public.business_plan_deliverables (business_plan_id, category, title, status, due_date, is_milestone, sort_order)
select business_plan_id, 'Milestone', title, case when done then 'done' else 'not_started' end, due_date, true, sort_order
from public.business_plan_milestones;

drop table if exists public.business_plan_milestones;
;
