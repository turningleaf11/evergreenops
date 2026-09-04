-- Business Plans: top-level entity per business venture/line (Fix & Flip,
-- Buy & Hold/Portfolio, CloserDojo, etc.), independent of the department org
-- chart. Deliverables checklist, roles, and a business_plan_id tagging column
-- on goals/cadences/documents/whiteboards so records created "in context"
-- from a plan still live in their native table.

create table if not exists public.business_plans (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete set null,
  title text not null,
  one_liner text,
  status text not null default 'planning', -- planning | building | scaling | paused
  owner_id uuid references auth.users(id) on delete set null,
  visibility text not null default 'workspace', -- workspace | departments | private
  shared_with jsonb not null default '{"departmentIds": [], "memberIds": []}'::jsonb,
  milestones jsonb not null default '[]'::jsonb,   -- [{title, date, done}]
  risks jsonb not null default '[]'::jsonb,         -- [{text, severity}]
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_plan_deliverables (
  id uuid primary key default gen_random_uuid(),
  business_plan_id uuid not null references public.business_plans(id) on delete cascade,
  category text not null default 'General',
  title text not null,
  status text not null default 'not_started', -- not_started | in_progress | done
  link_url text,
  file_url text,
  linked_project_id uuid references public.projects(id) on delete set null,
  linked_task_id uuid references public.tasks(id) on delete set null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists business_plan_deliverables_plan_idx on public.business_plan_deliverables (business_plan_id, sort_order);

create table if not exists public.business_plan_roles (
  id uuid primary key default gen_random_uuid(),
  business_plan_id uuid not null references public.business_plans(id) on delete cascade,
  role_title text not null,
  assigned_user_id uuid references auth.users(id) on delete set null,
  notes text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists business_plan_roles_plan_idx on public.business_plan_roles (business_plan_id, sort_order);

-- Formalize whiteboards: the table exists in the live DB (WhiteboardsPage.tsx /
-- WhiteboardDetailPage.tsx query it via `as any`) but has no prior migration
-- and isn't in generated types. This is idempotent against the existing table.
create table if not exists public.whiteboards (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Untitled board',
  description text,
  cover_color text,
  document jsonb,
  created_by uuid references auth.users(id) on delete set null,
  workspace_id uuid references public.workspaces(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Create-in-context tagging: nullable FK on every linkable table.
alter table public.goals add column if not exists business_plan_id uuid references public.business_plans(id) on delete set null;
alter table public.cadences add column if not exists business_plan_id uuid references public.business_plans(id) on delete set null;
alter table public.documents add column if not exists business_plan_id uuid references public.business_plans(id) on delete set null;
alter table public.whiteboards add column if not exists business_plan_id uuid references public.business_plans(id) on delete set null;

create index if not exists goals_business_plan_idx on public.goals (business_plan_id);
create index if not exists cadences_business_plan_idx on public.cadences (business_plan_id);
create index if not exists documents_business_plan_idx on public.documents (business_plan_id);
create index if not exists whiteboards_business_plan_idx on public.whiteboards (business_plan_id);

alter table public.business_plans enable row level security;
alter table public.business_plan_deliverables enable row level security;
alter table public.business_plan_roles enable row level security;
alter table public.whiteboards enable row level security;

drop policy if exists "business_plans authenticated all" on public.business_plans;
create policy "business_plans authenticated all" on public.business_plans for all to authenticated using (true) with check (true);

drop policy if exists "business_plan_deliverables authenticated all" on public.business_plan_deliverables;
create policy "business_plan_deliverables authenticated all" on public.business_plan_deliverables for all to authenticated using (true) with check (true);

drop policy if exists "business_plan_roles authenticated all" on public.business_plan_roles;
create policy "business_plan_roles authenticated all" on public.business_plan_roles for all to authenticated using (true) with check (true);

drop policy if exists "whiteboards authenticated all" on public.whiteboards;
create policy "whiteboards authenticated all" on public.whiteboards for all to authenticated using (true) with check (true);

drop trigger if exists business_plans_set_updated on public.business_plans;
create trigger business_plans_set_updated
  before update on public.business_plans
  for each row execute function public.update_updated_at_column();

drop trigger if exists business_plan_deliverables_set_updated on public.business_plan_deliverables;
create trigger business_plan_deliverables_set_updated
  before update on public.business_plan_deliverables
  for each row execute function public.update_updated_at_column();

drop trigger if exists whiteboards_set_updated on public.whiteboards;
create trigger whiteboards_set_updated
  before update on public.whiteboards
  for each row execute function public.update_updated_at_column();
;
