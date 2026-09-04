-- Phase 2: priority/sequencing across plans, a decision log, and two-way
-- sync so completing a promoted task/project checks the deliverable back off.

alter table public.business_plans
  add column if not exists priority text not null default 'medium';

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
;
