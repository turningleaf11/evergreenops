-- Cash autonomous work queue V1.
-- The heartbeat claims only SFR underwriting work because Portfolio napkin
-- execution is not yet implemented. CashValue is persisted as an underwriting
-- step, not as a completed full underwriting recommendation.

create table if not exists public.cash_underwriting_steps (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  cash_work_item_id uuid not null references public.cash_work_items(id) on delete cascade,
  agent_task_id uuid not null references public.agent_tasks(id) on delete restrict,
  candidate_id uuid references public.ema_candidates(id) on delete set null,
  ghl_opportunity_id text not null,
  activation_count integer not null check (activation_count >= 1),
  phase text not null check (phase in ('cash_value','rehab','mao','dealcheck','final')),
  status text not null check (status in ('succeeded','needs_info','blocked','failed')),
  output jsonb not null default '{}'::jsonb check (jsonb_typeof(output) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cash_work_item_id, activation_count, phase)
);

create index if not exists cash_underwriting_steps_opportunity_idx
  on public.cash_underwriting_steps (workspace_id, ghl_opportunity_id, created_at desc);

alter table public.cash_underwriting_steps enable row level security;
revoke all on table public.cash_underwriting_steps from public, anon, authenticated;
grant all on table public.cash_underwriting_steps to service_role;

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
security definer
set search_path = public, pg_temp
as $$
declare
  _item public.cash_work_items%rowtype;
  _task public.agent_tasks%rowtype;
  _resumed boolean := false;
  _phases text[] := '{}'::text[];
begin
  -- Resume an already-active SFR job first. This makes agent restarts safe.
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
    and s.status in ('succeeded','needs_info');

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
values ('fa88ef77-5d1d-428b-b61b-dbfb397299bc', 'underwriting.next_work_item', true, 12)
on conflict (agent_id, action) do update
set enabled = excluded.enabled,
    rate_limit_per_minute = excluded.rate_limit_per_minute,
    updated_at = now();
