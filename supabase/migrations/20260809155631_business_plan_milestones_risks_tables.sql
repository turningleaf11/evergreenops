-- Promote milestones/risks from jsonb blobs on business_plans to real,
-- individually addressable rows — mirrors business_plan_deliverables /
-- business_plan_roles. A jsonb array has no per-item identity, so nothing
-- (a mention, a future FK, an independent updated_at) could ever point at
-- "milestone #3" specifically. Real rows fix that.

create table if not exists public.business_plan_milestones (
  id uuid primary key default gen_random_uuid(),
  business_plan_id uuid not null references public.business_plans(id) on delete cascade,
  title text not null,
  done boolean not null default false,
  due_date date,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists business_plan_milestones_plan_idx on public.business_plan_milestones (business_plan_id, sort_order);

create table if not exists public.business_plan_risks (
  id uuid primary key default gen_random_uuid(),
  business_plan_id uuid not null references public.business_plans(id) on delete cascade,
  text text not null,
  severity text not null default 'med', -- high | med | low
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists business_plan_risks_plan_idx on public.business_plan_risks (business_plan_id, sort_order);

alter table public.business_plan_milestones enable row level security;
alter table public.business_plan_risks enable row level security;

drop policy if exists "business_plan_milestones authenticated all" on public.business_plan_milestones;
create policy "business_plan_milestones authenticated all" on public.business_plan_milestones for all to authenticated using (true) with check (true);

drop policy if exists "business_plan_risks authenticated all" on public.business_plan_risks;
create policy "business_plan_risks authenticated all" on public.business_plan_risks for all to authenticated using (true) with check (true);

drop trigger if exists business_plan_milestones_set_updated on public.business_plan_milestones;
create trigger business_plan_milestones_set_updated
  before update on public.business_plan_milestones
  for each row execute function public.update_updated_at_column();

drop trigger if exists business_plan_risks_set_updated on public.business_plan_risks;
create trigger business_plan_risks_set_updated
  before update on public.business_plan_risks
  for each row execute function public.update_updated_at_column();

-- Backfill existing jsonb rows into the new tables, preserving array order.
insert into public.business_plan_milestones (business_plan_id, title, done, sort_order)
select bp.id, elem->>'title', coalesce((elem->>'done')::boolean, false), (ord - 1)::int
from public.business_plans bp
cross join lateral jsonb_array_elements(coalesce(bp.milestones, '[]'::jsonb)) with ordinality as t(elem, ord)
where jsonb_typeof(coalesce(bp.milestones, '[]'::jsonb)) = 'array';

insert into public.business_plan_risks (business_plan_id, text, severity, sort_order)
select bp.id, elem->>'text', coalesce(elem->>'severity', 'med'), (ord - 1)::int
from public.business_plans bp
cross join lateral jsonb_array_elements(coalesce(bp.risks, '[]'::jsonb)) with ordinality as t(elem, ord)
where jsonb_typeof(coalesce(bp.risks, '[]'::jsonb)) = 'array';

alter table public.business_plans drop column if exists milestones;
alter table public.business_plans drop column if exists risks;
;
