-- Phase 2: priority/sequencing across plans, a decision log, and two-way
-- sync so completing a promoted task/project checks the deliverable back off.

-- ── Priority ────────────────────────────────────────────────────────────
-- Reuses the same low/medium/high/urgent scale tasks/projects already use
-- (src/lib/statusTone.ts resolvePriorityTone) rather than inventing a new
-- one — lets "portfolio is the strategic focus, F&F is bridge income" be
-- expressed in the same visual language as everything else in the app.
alter table public.business_plans
  add column if not exists priority text not null default 'medium';

-- ── Decision log ────────────────────────────────────────────────────────
create table if not exists public.business_plan_decisions (
  id uuid primary key default gen_random_uuid(),
  business_plan_id uuid not null references public.business_plans(id) on delete cascade,
  text text not null,
  decided_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists business_plan_decisions_plan_idx
  on public.business_plan_decisions (business_plan_id, created_at desc);

alter table public.business_plan_decisions enable row level security;
drop policy if exists "business_plan_decisions authenticated all" on public.business_plan_decisions;
create policy "business_plan_decisions authenticated all" on public.business_plan_decisions
  for all to authenticated using (true) with check (true);

-- ── Two-way sync: completing a promoted task/project checks the deliverable
-- back off. Fires regardless of where the status change happens (this page,
-- Execution Hub, a kanban drag) since it's a DB trigger, not client polling.
-- Also reverts the deliverable to in_progress if the task/project is
-- reopened, so the checklist doesn't silently lie once work resumes.
create or replace function public.sync_deliverable_from_task()
returns trigger language plpgsql as $$
begin
  if NEW.status = 'done' and (OLD.status is distinct from 'done') then
    update public.business_plan_deliverables
      set status = 'done', updated_at = now()
      where linked_task_id = NEW.id and status is distinct from 'done';
  elsif OLD.status = 'done' and NEW.status is distinct from 'done' then
    update public.business_plan_deliverables
      set status = 'in_progress', updated_at = now()
      where linked_task_id = NEW.id and status = 'done';
  end if;
  return NEW;
end;
$$;

drop trigger if exists tasks_sync_business_plan_deliverable on public.tasks;
create trigger tasks_sync_business_plan_deliverable
  after update of status on public.tasks
  for each row execute function public.sync_deliverable_from_task();

create or replace function public.sync_deliverable_from_project()
returns trigger language plpgsql as $$
begin
  if NEW.status = 'done' and (OLD.status is distinct from 'done') then
    update public.business_plan_deliverables
      set status = 'done', updated_at = now()
      where linked_project_id = NEW.id and status is distinct from 'done';
  elsif OLD.status = 'done' and NEW.status is distinct from 'done' then
    update public.business_plan_deliverables
      set status = 'in_progress', updated_at = now()
      where linked_project_id = NEW.id and status = 'done';
  end if;
  return NEW;
end;
$$;

drop trigger if exists projects_sync_business_plan_deliverable on public.projects;
create trigger projects_sync_business_plan_deliverable
  after update of status on public.projects
  for each row execute function public.sync_deliverable_from_project();
