alter table public.cash_work_items
  add column if not exists claim_lease_token uuid,
  add column if not exists claim_lease_expires_at timestamptz;

create index if not exists cash_work_items_active_lease_idx
  on public.cash_work_items(workspace_id, claim_lease_expires_at, last_activated_at)
  where work_kind = 'sfr_underwriting' and state = 'active';

create or replace function public.claim_cash_sfr_activation_signal(
  _workspace_id uuid,
  _activation_signal_id uuid,
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
  _signal public.cash_activation_signals%rowtype;
  _item public.cash_work_items%rowtype;
  _task public.agent_tasks%rowtype;
  _candidate public.ema_candidates%rowtype;
  _task_id uuid;
  _label text;
  _title text;
  _description text;
  _phases text[] := '{}'::text[];
  _lease_until timestamptz;
begin
  if _lease_token is null then
    raise exception 'cash_claim_lease_token_required' using errcode = '22023';
  end if;
  if _lease_seconds < 60 or _lease_seconds > 1800 then
    raise exception 'cash_claim_lease_seconds_invalid' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(_live_snapshot, '{}'::jsonb)) <> 'object' then
    raise exception 'cash_live_snapshot_invalid' using errcode = '22023';
  end if;
  if coalesce(_live_snapshot ->> 'eligible', 'false') <> 'true'
    or _live_snapshot ->> 'pipeline_id' <> 'w3OtDJjCdN840Hwb1fpt'
    or _live_snapshot ->> 'stage_id' <> '1c3468f6-1a5d-4025-bf20-2bc4bd195708'
    or lower(coalesce(_live_snapshot ->> 'status', '')) <> 'open'
    or _live_snapshot ->> 'property_type' <> 'Single Family Residence' then
    raise exception 'cash_live_eligibility_required' using errcode = '22023';
  end if;

  select * into _signal
  from public.cash_activation_signals
  where id = _activation_signal_id
    and workspace_id = _workspace_id
  for update;

  if not found or _signal.state <> 'pending' then
    return;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(_workspace_id::text || ':' || _signal.ghl_opportunity_id || ':sfr_underwriting', 0)
  );

  if _signal.trigger_pipeline_id <> 'w3OtDJjCdN840Hwb1fpt'
    or _signal.trigger_stage_id <> '1c3468f6-1a5d-4025-bf20-2bc4bd195708' then
    raise exception 'cash_activation_signal_route_invalid' using errcode = 'P0002';
  end if;
  if _live_snapshot ->> 'opportunity_id' is distinct from _signal.ghl_opportunity_id then
    raise exception 'cash_live_opportunity_mismatch' using errcode = 'P0002';
  end if;

  _lease_until := now() + make_interval(secs => _lease_seconds);
  _label := coalesce(
    nullif(trim(_live_snapshot ->> 'address'), ''),
    nullif(trim(_live_snapshot ->> 'name'), ''),
    _signal.ghl_opportunity_id
  );
  _label := left(_label, 500);
  _title := 'Underwrite: ' || _label;
  _description := 'Cash full SFR underwriting claimed just-in-time after live HighLevel eligibility verification.';

  if _signal.candidate_id is not null then
    select * into _candidate
    from public.ema_candidates
    where id = _signal.candidate_id
      and workspace_id = _workspace_id
      and ghl_opportunity_id = _signal.ghl_opportunity_id
    for update;
    if not found then
      raise exception 'candidate_opportunity_mismatch' using errcode = 'P0002';
    end if;
  end if;

  select * into _item
  from public.cash_work_items
  where workspace_id = _workspace_id
    and ghl_opportunity_id = _signal.ghl_opportunity_id
    and work_kind = 'sfr_underwriting'
  for update;

  if found then
    if _item.activation_count > _signal.activation_count then
      update public.cash_activation_signals
      set state = 'stale',
          stale_at = now(),
          stale_reason = 'superseded_activation',
          live_snapshot = _live_snapshot,
          updated_at = now()
      where id = _signal.id;
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

    if _item.activation_count = _signal.activation_count
      and _item.last_event_id is distinct from _signal.source_stage_event_id then
      update public.cash_activation_signals
      set state = 'stale',
          stale_at = now(),
          stale_reason = 'activation_identity_conflict',
          live_snapshot = _live_snapshot,
          updated_at = now()
      where id = _signal.id;
      return;
    end if;

    if _item.activation_count = _signal.activation_count
      and _item.last_event_id = _signal.source_stage_event_id
      and _item.state in ('review','completed') then
      update public.cash_activation_signals
      set state = 'completed',
          completed_at = coalesce(completed_at, now()),
          cash_work_item_id = _item.id,
          live_snapshot = _live_snapshot,
          updated_at = now()
      where id = _signal.id;
      return;
    end if;

    if _item.activation_count = _signal.activation_count
      and _item.last_event_id = _signal.source_stage_event_id
      and _item.state = 'active'
      and _item.claim_lease_expires_at is not null
      and _item.claim_lease_expires_at > now() then
      return;
    end if;

    _task_id := _item.agent_task_id;

    update public.agent_tasks
    set title = _title,
        description = _description,
        status = 'in_progress',
        priority = 'high',
        archived = false,
        started_at = coalesce(started_at, now()),
        context = coalesce(context, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
          'source', 'ghl_activation_signal',
          'activation_version', 'v3_jit',
          'activation_mode', 'live_ghl_jit',
          'activation_status', 'active',
          'subject_origin', case when _signal.candidate_id is null then 'manual_ghl' else 'ema_candidate' end,
          'ema_candidate_id', _signal.candidate_id,
          'ghl_opportunity_id', _signal.ghl_opportunity_id,
          'pipeline_id', _signal.trigger_pipeline_id,
          'trigger_stage_id', _signal.trigger_stage_id,
          'last_stage_event_id', _signal.source_stage_event_id,
          'activation_signal_id', _signal.id,
          'activation_count', _signal.activation_count,
          'live_ghl_verified_at', _live_snapshot ->> 'verified_at'
        )),
        updated_at = now()
    where id = _task_id;

    update public.cash_work_items
    set candidate_id = coalesce(public.cash_work_items.candidate_id, _signal.candidate_id),
        state = 'active',
        trigger_pipeline_id = _signal.trigger_pipeline_id,
        trigger_stage_id = _signal.trigger_stage_id,
        activation_count = _signal.activation_count,
        last_activated_at = _signal.activated_at,
        last_event_id = _signal.source_stage_event_id,
        claim_lease_token = _lease_token,
        claim_lease_expires_at = _lease_until,
        updated_at = now()
    where id = _item.id
    returning * into _item;
  else
    if _signal.candidate_id is not null and _candidate.cash_task_id is not null then
      select * into _task
      from public.agent_tasks
      where id = _candidate.cash_task_id
        and workspace_id = _workspace_id
        and assigned_to = 'cash'
      for update;
    end if;

    if found then
      _task_id := _task.id;
      update public.agent_tasks
      set title = _title,
          description = _description,
          status = 'in_progress',
          priority = 'high',
          archived = false,
          started_at = coalesce(started_at, now()),
          context = coalesce(context, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
            'source', 'ghl_activation_signal',
            'activation_version', 'v3_jit',
            'activation_mode', 'live_ghl_jit',
            'activation_status', 'active',
            'subject_origin', 'ema_candidate',
            'ema_candidate_id', _signal.candidate_id,
            'ghl_opportunity_id', _signal.ghl_opportunity_id,
            'pipeline_id', _signal.trigger_pipeline_id,
            'trigger_stage_id', _signal.trigger_stage_id,
            'last_stage_event_id', _signal.source_stage_event_id,
            'activation_signal_id', _signal.id,
            'activation_count', _signal.activation_count,
            'live_ghl_verified_at', _live_snapshot ->> 'verified_at'
          )),
          updated_at = now()
      where id = _task_id;
    else
      insert into public.agent_tasks (
        title, description, assigned_to, status, priority, context,
        created_by, workspace_id, type, archived, started_at
      ) values (
        _title,
        _description,
        'cash',
        'in_progress',
        'high',
        jsonb_strip_nulls(jsonb_build_object(
          'source', 'ghl_activation_signal',
          'activation_version', 'v3_jit',
          'activation_mode', 'live_ghl_jit',
          'activation_status', 'active',
          'subject_origin', case when _signal.candidate_id is null then 'manual_ghl' else 'ema_candidate' end,
          'ema_candidate_id', _signal.candidate_id,
          'ghl_opportunity_id', _signal.ghl_opportunity_id,
          'pipeline_id', _signal.trigger_pipeline_id,
          'trigger_stage_id', _signal.trigger_stage_id,
          'last_stage_event_id', _signal.source_stage_event_id,
          'activation_signal_id', _signal.id,
          'activation_count', _signal.activation_count,
          'live_ghl_verified_at', _live_snapshot ->> 'verified_at'
        )),
        'cash_jit_claim',
        _workspace_id,
        'research',
        false,
        now()
      ) returning id into _task_id;
    end if;

    insert into public.cash_work_items (
      workspace_id,
      candidate_id,
      ghl_opportunity_id,
      agent_task_id,
      work_kind,
      state,
      trigger_pipeline_id,
      trigger_stage_id,
      activation_count,
      first_activated_at,
      last_activated_at,
      last_event_id,
      claim_lease_token,
      claim_lease_expires_at
    ) values (
      _workspace_id,
      _signal.candidate_id,
      _signal.ghl_opportunity_id,
      _task_id,
      'sfr_underwriting',
      'active',
      _signal.trigger_pipeline_id,
      _signal.trigger_stage_id,
      _signal.activation_count,
      _signal.activated_at,
      _signal.activated_at,
      _signal.source_stage_event_id,
      _lease_token,
      _lease_until
    ) returning * into _item;

    if _signal.candidate_id is not null then
      update public.ema_candidates
      set cash_task_id = _task_id,
          updated_at = now()
      where id = _signal.candidate_id
        and workspace_id = _workspace_id;
    end if;
  end if;

  update public.cash_activation_signals
  set state = 'claimed',
      claimed_at = coalesce(claimed_at, now()),
      cash_work_item_id = _item.id,
      live_snapshot = _live_snapshot,
      updated_at = now()
  where id = _signal.id;

  select * into _task
  from public.agent_tasks
  where id = _item.agent_task_id
    and workspace_id = _workspace_id;

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
    false,
    _phases;
end;
$$;

revoke all on function public.claim_cash_sfr_activation_signal(uuid, uuid, uuid, jsonb, integer)
  from public, anon, authenticated;
grant execute on function public.claim_cash_sfr_activation_signal(uuid, uuid, uuid, jsonb, integer)
  to service_role;;
