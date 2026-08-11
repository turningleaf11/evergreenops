-- Restore milestones as their own concept, this time nested under goals.
--
-- Reverts 20260809160000, which folded milestones into deliverables as a
-- flag. That was the wrong pairing: a deliverable is an artifact you produce
-- ("buy box defined"), a milestone is a moment you reach ("first flip
-- closed"). ClickUp's flag-a-task-as-milestone model works there because a
-- task is a generic unit of work — our deliverable is not generic.
--
-- The research (EOS, Asana, Linear) actually points at milestones nesting
-- under GOALS, so goal_id is the link — nullable, since a milestone can also
-- stand alone on the plan's timeline.

create table if not exists public.business_plan_milestones (
  id uuid primary key default gen_random_uuid(),
  business_plan_id uuid not null references public.business_plans(id) on delete cascade,
  goal_id uuid references public.goals(id) on delete set null,
  title text not null,
  done boolean not null default false,
  due_date date,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists business_plan_milestones_plan_idx on public.business_plan_milestones (business_plan_id, sort_order);
create index if not exists business_plan_milestones_goal_idx on public.business_plan_milestones (goal_id);

alter table public.business_plan_milestones enable row level security;

drop policy if exists "business_plan_milestones authenticated all" on public.business_plan_milestones;
create policy "business_plan_milestones authenticated all" on public.business_plan_milestones for all to authenticated using (true) with check (true);

drop trigger if exists business_plan_milestones_set_updated on public.business_plan_milestones;
create trigger business_plan_milestones_set_updated
  before update on public.business_plan_milestones
  for each row execute function public.update_updated_at_column();

-- Move the flagged deliverables back out into real milestones.
insert into public.business_plan_milestones (business_plan_id, title, done, due_date, sort_order)
select business_plan_id, title, status = 'done', due_date, sort_order
from public.business_plan_deliverables
where is_milestone = true;

delete from public.business_plan_deliverables where is_milestone = true;

alter table public.business_plan_deliverables drop column if exists is_milestone;
