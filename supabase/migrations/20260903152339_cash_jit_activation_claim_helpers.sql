create or replace function public.lease_active_cash_sfr_work_item(
  _workspace_id uuid,
  _work_item_id uuid,
  _lease_token uuid,
  _live_snapshot jsonb,
  _lease_seconds integer default 600
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
  _phases text[] := '{}'::text[];
  _lease_until timestamptz;
begin
  if _lease_token is null then
    raise exception 'cash_claim_lease_token_required' using errcode = '22023';
  end if;
  if _lease_seconds < 60 or _lease_seconds > 1800 then
    raise exception 'cash_claim_lease_seconds_invalid' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(_live_snapshot, '{}'::jsonb)) <> 'object'
    or coalesce(_live_snapshot ->> 'eligible', 'false') <> 'true'
    or _live_snapshot ->> 'pipeline_id' <> 'w3OtDJjCdN840Hwb1fpt'
    or _live_snapshot ->> 'stage_id' <> '1c3468f6-1a5d-4025-bf20-2bc4bd195708'
    or lower(coalesce(_live_snapshot ->> 'status', '')) <> 'open'
    or _live_snapshot ->> 'property_type' <> 'Single Family Residence' then
    raise exception 'cash_live_eligibility_required' using errcode = '22023';
  end if;

  select * into _item
  from public.cash_work_items
  where id = _work_item_id
    and workspace_id = _workspace_id
    and work_kind = 'sfr_underwriting'
    and state = 'active'
  for update;
  if not found then return; end if;

  if _live_snapshot ->> 'opportunity_id' is distinct from _item.ghl_opportunity_id then
    raise exception 'cash_live_opportunity_mismatch' using errcode = 'P0002';
  end if;

  if _item.claim_lease_expires_at is not null and _item.claim_lease_expires_at > now() then
    return;
  end if;

  select * into _task
  from public.agent_tasks
  where id = _item.agent_task_id
    and workspace_id = _workspace_id
    and assigned_to = 'cash'
    and status = 'in_progress'
    and archived = false
  for update;
  if not found then return; end if;

  _lease_until := now() + make_interval(secs => _lease_seconds);
  update public.cash_work_items
  set claim_lease_token = _lease_token,
      claim_lease_expires_at = _lease_until,
      updated_at = now()
  where id = _item.id
  returning * into _item;

  update public.agent_tasks
  set context = coalesce(context, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
        'cash_runtime_status', 'active',
        'cash_last_resumed_at', now(),
        'live_ghl_verified_at', _live_snapshot ->> 'verified_at'
      )),
      updated_at = now()
  where id = _task.id;

  update public.cash_activation_signals
  set state = case when state = 'pending' then 'claimed' else state end,
      claimed_at = case when state = 'pending' then coalesce(claimed_at, now()) else claimed_at end,
      cash_work_item_id = _item.id,
      live_snapshot = _live_snapshot,
      updated_at = now()
  where workspace_id = _workspace_id
    and source_stage_event_id = _item.last_event_id
    and state in ('pending','claimed');

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
    true,
    _phases;
end;
$$;

revoke all on function public.lease_active_cash_sfr_work_item(uuid, uuid, uuid, jsonb, integer)
  from public, anon, authenticated;
grant execute on function public.lease_active_cash_sfr_work_item(uuid, uuid, uuid, jsonb, integer)
  to service_role;

create or replace function public.stale_cash_sfr_activation_signal(
  _workspace_id uuid,
  _activation_signal_id uuid,
  _reason text,
  _live_snapshot jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if _reason is null or length(_reason) < 1 or length(_reason) > 128 then
    raise exception 'cash_stale_reason_invalid' using errcode = '22023';
  end if;
  update public.cash_activation_signals
  set state = 'stale',
      stale_at = now(),
      stale_reason = _reason,
      live_snapshot = coalesce(_live_snapshot, '{}'::jsonb),
      updated_at = now()
  where id = _activation_signal_id
    and workspace_id = _workspace_id
    and state = 'pending';
  return found;
end;
$$;

revoke all on function public.stale_cash_sfr_activation_signal(uuid, uuid, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.stale_cash_sfr_activation_signal(uuid, uuid, text, jsonb)
  to service_role;

create or replace function public.block_stale_cash_sfr_work_item(
  _workspace_id uuid,
  _work_item_id uuid,
  _reason text,
  _live_snapshot jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  _item public.cash_work_items%rowtype;
begin
  if _reason is null or length(_reason) < 1 or length(_reason) > 128 then
    raise exception 'cash_stale_reason_invalid' using errcode = '22023';
  end if;

  select * into _item
  from public.cash_work_items
  where id = _work_item_id
    and workspace_id = _workspace_id
    and work_kind = 'sfr_underwriting'
    and state = 'active'
  for update;
  if not found then return false; end if;

  update public.cash_work_items
  set state = 'blocked',
      claim_lease_token = null,
      claim_lease_expires_at = null,
      updated_at = now()
  where id = _item.id;

  update public.agent_tasks
  set status = 'blocked',
      context = coalesce(context, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
        'cash_runtime_status', 'blocked',
        'cash_block_reason', _reason,
        'cash_blocked_at', now(),
        'cash_block_source', 'live_ghl_jit',
        'live_ghl_verified_at', _live_snapshot ->> 'verified_at'
      )),
      updated_at = now()
  where id = _item.agent_task_id
    and workspace_id = _workspace_id
    and assigned_to = 'cash';

  update public.cash_activation_signals
  set state = 'stale',
      stale_at = now(),
      stale_reason = _reason,
      live_snapshot = coalesce(_live_snapshot, '{}'::jsonb),
      updated_at = now()
  where workspace_id = _workspace_id
    and source_stage_event_id = _item.last_event_id
    and state in ('pending','claimed');

  return true;
end;
$$;

revoke all on function public.block_stale_cash_sfr_work_item(uuid, uuid, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.block_stale_cash_sfr_work_item(uuid, uuid, text, jsonb)
  to service_role;;
