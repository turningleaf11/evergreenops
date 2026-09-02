-- Cash SFR activation signals.
--
-- HighLevel stage entry is an activation signal, not proof that Cash should
-- still work the deal later. The live GHL opportunity is revalidated when Cash
-- asks for work. A durable Cash work item is created only after that live check.

create table if not exists public.cash_activation_signals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  ghl_opportunity_id text not null,
  candidate_id uuid references public.ema_candidates(id) on delete set null,
  source_stage_event_id uuid not null references public.ghl_stage_events(id) on delete restrict,
  trigger_pipeline_id text not null,
  trigger_stage_id text not null,
  activation_count integer not null check (activation_count >= 1),
  state text not null default 'pending' check (state in ('pending','claimed','stale','completed')),
  activated_at timestamptz not null,
  claimed_at timestamptz,
  stale_at timestamptz,
  completed_at timestamptz,
  stale_reason text,
  cash_work_item_id uuid references public.cash_work_items(id) on delete set null,
  live_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(live_snapshot) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, source_stage_event_id),
  unique (workspace_id, ghl_opportunity_id, activation_count)
);

create index if not exists cash_activation_signals_pending_idx
  on public.cash_activation_signals(workspace_id, activated_at, created_at)
  where state = 'pending';

create index if not exists cash_activation_signals_opportunity_idx
  on public.cash_activation_signals(workspace_id, ghl_opportunity_id, activation_count desc);

alter table public.cash_activation_signals enable row level security;
revoke all on table public.cash_activation_signals from public, anon, authenticated;
grant all on table public.cash_activation_signals to service_role;

create or replace function public.create_cash_sfr_activation_signal(
  _workspace_id uuid,
  _candidate_id uuid,
  _ghl_opportunity_id text,
  _pipeline_id text,
  _stage_id text,
  _event_id uuid,
  _activated_at timestamptz default now()
)
returns table (
  activation_signal_id uuid,
  activation_count integer,
  reused_signal boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  _event public.ghl_stage_events%rowtype;
  _candidate public.ema_candidates%rowtype;
  _existing public.cash_activation_signals%rowtype;
  _next_count integer;
begin
  if _pipeline_id <> 'w3OtDJjCdN840Hwb1fpt'
    or _stage_id <> '1c3468f6-1a5d-4025-bf20-2bc4bd195708' then
    raise exception 'unsupported_cash_sfr_activation' using errcode = '22023';
  end if;

  if _ghl_opportunity_id is null
    or length(_ghl_opportunity_id) < 1
    or length(_ghl_opportunity_id) > 128 then
    raise exception 'invalid_ghl_opportunity_id' using errcode = '22023';
  end if;

  select * into _event
  from public.ghl_stage_events
  where id = _event_id
    and workspace_id = _workspace_id
    and authenticated = true
    and opportunity_id = _ghl_opportunity_id
    and pipeline_id = _pipeline_id
    and stage_id = _stage_id
  for update;

  if not found then
    raise exception 'cash_activation_event_mismatch' using errcode = 'P0002';
  end if;

  if _candidate_id is not null then
    select * into _candidate
    from public.ema_candidates
    where id = _candidate_id
      and workspace_id = _workspace_id
      and ghl_opportunity_id = _ghl_opportunity_id;
    if not found then
      raise exception 'candidate_opportunity_mismatch' using errcode = 'P0002';
    end if;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(_workspace_id::text || ':' || _ghl_opportunity_id || ':sfr_activation', 0)
  );

  select * into _existing
  from public.cash_activation_signals
  where workspace_id = _workspace_id
    and source_stage_event_id = _event_id
  for update;

  if found then
    return query select _existing.id, _existing.activation_count, true;
    return;
  end if;

  select coalesce(max(s.activation_count), 0) + 1
  into _next_count
  from public.cash_activation_signals s
  where s.workspace_id = _workspace_id
    and s.ghl_opportunity_id = _ghl_opportunity_id;

  insert into public.cash_activation_signals (
    workspace_id,
    ghl_opportunity_id,
    candidate_id,
    source_stage_event_id,
    trigger_pipeline_id,
    trigger_stage_id,
    activation_count,
    state,
    activated_at
  ) values (
    _workspace_id,
    _ghl_opportunity_id,
    _candidate_id,
    _event_id,
    _pipeline_id,
    _stage_id,
    _next_count,
    'pending',
    coalesce(_activated_at, now())
  )
  returning id into activation_signal_id;

  activation_count := _next_count;
  reused_signal := false;
  return next;
end;
$$;

revoke all on function public.create_cash_sfr_activation_signal(uuid, uuid, text, text, text, uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.create_cash_sfr_activation_signal(uuid, uuid, text, text, text, uuid, timestamptz)
  to service_role;

-- Transition safety: until the receivers are switched to signal-only mode, they
-- still finalize the historical durable-work path with decision=activated or
-- reconciled. Dual-write those successful SFR activations into the signal table
-- so no event can fall into the migration-to-receiver-cutover window. Once the
-- signal-only receiver is deployed, it creates the same signal before finalize;
-- this trigger then becomes an idempotent no-op for that source stage event.
create or replace function public.dual_write_cash_sfr_activation_signal()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  _signal_id uuid;
begin
  if new.authenticated = true
    and new.opportunity_id is not null
    and new.pipeline_id = 'w3OtDJjCdN840Hwb1fpt'
    and new.stage_id = '1c3468f6-1a5d-4025-bf20-2bc4bd195708'
    and new.decision in ('activated','reconciled') then
    select activation_signal_id
      into _signal_id
    from public.create_cash_sfr_activation_signal(
      new.workspace_id,
      new.candidate_id,
      new.opportunity_id,
      new.pipeline_id,
      new.stage_id,
      new.id,
      coalesce(new.event_timestamp, new.created_at, now())
    )
    limit 1;
  end if;
  return new;
end;
$$;

revoke all on function public.dual_write_cash_sfr_activation_signal()
  from public, anon, authenticated;

drop trigger if exists trg_dual_write_cash_sfr_activation_signal on public.ghl_stage_events;
create trigger trg_dual_write_cash_sfr_activation_signal
  after insert or update of decision, candidate_id on public.ghl_stage_events
  for each row
  when (
    new.authenticated = true
    and new.opportunity_id is not null
    and new.pipeline_id = 'w3OtDJjCdN840Hwb1fpt'
    and new.stage_id = '1c3468f6-1a5d-4025-bf20-2bc4bd195708'
    and new.decision in ('activated','reconciled')
  )
  execute function public.dual_write_cash_sfr_activation_signal();

-- Seed activation signals from already-authenticated historical SFR stage-entry
-- events. Live GHL validation at claim time will discard entries that are now
-- DEAD, moved, abandoned, or otherwise no longer eligible.
with ranked as (
  select
    e.id as source_stage_event_id,
    e.workspace_id,
    e.opportunity_id as ghl_opportunity_id,
    e.candidate_id,
    e.pipeline_id,
    e.stage_id,
    coalesce(e.event_timestamp, e.created_at) as activated_at,
    row_number() over (
      partition by e.workspace_id, e.opportunity_id
      order by coalesce(e.event_timestamp, e.created_at), e.created_at, e.id
    )::integer as activation_count
  from public.ghl_stage_events e
  where e.authenticated = true
    and e.opportunity_id is not null
    and e.pipeline_id = 'w3OtDJjCdN840Hwb1fpt'
    and e.stage_id = '1c3468f6-1a5d-4025-bf20-2bc4bd195708'
    and e.decision in ('activated','reconciled')
)
insert into public.cash_activation_signals (
  workspace_id,
  ghl_opportunity_id,
  candidate_id,
  source_stage_event_id,
  trigger_pipeline_id,
  trigger_stage_id,
  activation_count,
  state,
  activated_at
)
select
  r.workspace_id,
  r.ghl_opportunity_id,
  r.candidate_id,
  r.source_stage_event_id,
  r.pipeline_id,
  r.stage_id,
  r.activation_count,
  'pending',
  r.activated_at
from ranked r
on conflict (workspace_id, source_stage_event_id) do nothing;
