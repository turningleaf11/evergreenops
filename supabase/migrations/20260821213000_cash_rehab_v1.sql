-- Cash Rehab V1.
-- Rehab scope can be supplied by the Cash agent only as source-backed observations.
-- Dollar rates and contingency live in a workspace-scoped cost book, never in
-- model-visible tool input. No production cost assumptions are seeded here.

create table if not exists public.rehab_cost_books (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 160),
  market text not null check (length(btrim(market)) between 1 and 160),
  version integer not null check (version >= 1),
  status text not null default 'draft' check (status in ('draft','active','retired')),
  default_contingency_pct numeric(5,2) not null check (default_contingency_pct >= 0 and default_contingency_pct <= 30),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, name, version)
);

create unique index if not exists rehab_cost_books_one_active_per_workspace_idx
  on public.rehab_cost_books (workspace_id)
  where status = 'active';

create table if not exists public.rehab_cost_book_items (
  id uuid primary key default gen_random_uuid(),
  cost_book_id uuid not null references public.rehab_cost_books(id) on delete cascade,
  category text not null check (category in (
    'kitchen','bathrooms','flooring','paint','roof','hvac','electrical','plumbing',
    'windows_doors','landscaping','permits','misc'
  )),
  scope_level text not null check (scope_level in ('light','medium','heavy','replace')),
  unit text not null check (unit in ('allowance','sqft','each','linear_ft')),
  unit_cost_low numeric(12,2) not null check (unit_cost_low >= 0),
  unit_cost_base numeric(12,2) not null check (unit_cost_base >= unit_cost_low),
  unit_cost_high numeric(12,2) not null check (unit_cost_high >= unit_cost_base),
  notes text,
  source_reference text not null check (length(btrim(source_reference)) between 1 and 1000),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cost_book_id, category, scope_level)
);

alter table public.rehab_cost_books enable row level security;
alter table public.rehab_cost_book_items enable row level security;
revoke all on table public.rehab_cost_books from public, anon, authenticated;
revoke all on table public.rehab_cost_book_items from public, anon, authenticated;
grant all on table public.rehab_cost_books to service_role;
grant all on table public.rehab_cost_book_items to service_role;

comment on table public.rehab_cost_books is
  'Workspace-scoped deterministic repair-cost policy. Cash cannot set rates through MCP.';
comment on table public.rehab_cost_book_items is
  'Versioned rehab unit-cost ranges keyed by category and scope. Every rate requires provenance; no model-generated rates.';
comment on column public.rehab_cost_book_items.source_reference is
  'Required provenance for the rate, such as an Evergreen completed-job reference, approved vendor quote, or approved published estimator/source.';

-- A phase is completed only when it actually succeeded. A needs_info CashValue
-- or Rehab step remains the next phase instead of allowing Cash to advance.
create or replace function public.claim_next_cash_sfr_work_item(
  _workspace_id uuid
)
returns table (
  work_item_id uuid,
  agent_task_id uuid,
  candidate_id uuid,
  ghl_opportunity_id text,
  work_kind text,
  activation_count integer,
  task_title text,
  task_description text,
  resumed boolean,
  completed_phases text[]
)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  _item public.cash_work_items%rowtype;
  _task public.agent_tasks%rowtype;
  _resumed boolean := false;
  _phases text[] := '{}'::text[];
begin
  select wi.* into _item
  from public.cash_work_items wi
  join public.agent_tasks t on t.id = wi.agent_task_id
  where wi.workspace_id = _workspace_id
    and wi.work_kind = 'sfr_underwriting'
    and wi.state = 'active'
    and t.workspace_id = _workspace_id
    and t.assigned_to = 'cash'
    and t.status = 'in_progress'
    and t.archived = false
  order by wi.last_activated_at asc, wi.created_at asc
  for update of wi skip locked
  limit 1;

  if found then
    _resumed := true;
  else
    select wi.* into _item
    from public.cash_work_items wi
    join public.agent_tasks t on t.id = wi.agent_task_id
    where wi.workspace_id = _workspace_id
      and wi.work_kind = 'sfr_underwriting'
      and wi.state = 'queued'
      and t.workspace_id = _workspace_id
      and t.assigned_to = 'cash'
      and t.status = 'todo'
      and t.archived = false
    order by
      case t.priority when 'urgent' then 0 when 'high' then 1 when 'normal' then 2 when 'low' then 3 else 4 end,
      wi.last_activated_at asc,
      wi.created_at asc
    for update of wi skip locked
    limit 1;
  end if;

  if not found then
    return;
  end if;

  select * into _task
  from public.agent_tasks
  where id = _item.agent_task_id
    and workspace_id = _workspace_id
    and assigned_to = 'cash'
  for update;

  if not found then
    raise exception 'cash_work_item_task_invalid' using errcode = 'P0002';
  end if;

  if not _resumed then
    update public.cash_work_items
    set state = 'active', updated_at = now()
    where id = _item.id;

    update public.agent_tasks
    set status = 'in_progress',
        started_at = coalesce(started_at, now()),
        context = coalesce(context, '{}'::jsonb) || jsonb_build_object(
          'cash_runtime_status', 'active',
          'cash_last_claimed_at', now()
        ),
        updated_at = now()
    where id = _item.agent_task_id;
  else
    update public.agent_tasks
    set context = coalesce(context, '{}'::jsonb) || jsonb_build_object(
          'cash_runtime_status', 'active',
          'cash_last_resumed_at', now()
        ),
        updated_at = now()
    where id = _item.agent_task_id;
  end if;

  select coalesce(array_agg(s.phase order by s.created_at), '{}'::text[])
  into _phases
  from public.cash_underwriting_steps s
  where s.cash_work_item_id = _item.id
    and s.activation_count = _item.activation_count
    and s.status = 'succeeded';

  return query select
    _item.id,
    _item.agent_task_id,
    _item.candidate_id,
    _item.ghl_opportunity_id,
    _item.work_kind,
    _item.activation_count,
    _task.title,
    _task.description,
    _resumed,
    _phases;
end;
$$;

revoke all on function public.claim_next_cash_sfr_work_item(uuid) from public, anon, authenticated;
grant execute on function public.claim_next_cash_sfr_work_item(uuid) to service_role;

insert into public.agent_permissions (agent_id, action, enabled, rate_limit_per_minute)
select a.id, 'underwriting.rehab', true, 12
from public.agents a
where a.slug = 'cash'
on conflict (agent_id, action) do update
set enabled = excluded.enabled,
    rate_limit_per_minute = excluded.rate_limit_per_minute,
    updated_at = now();
