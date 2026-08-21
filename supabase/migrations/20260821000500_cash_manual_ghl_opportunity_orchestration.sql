-- Allow Cash orchestration to work for human-created HighLevel opportunities
-- without manufacturing an Ema candidate. The HighLevel opportunity remains
-- the durable work identity; candidate_id is optional context when Ema created it.

alter table public.cash_work_items
  alter column candidate_id drop not null;

create or replace function public.reconcile_cash_stage_trigger_v2(
  _workspace_id uuid,
  _candidate_id uuid,
  _ghl_opportunity_id text,
  _opportunity_label text,
  _work_kind text,
  _pipeline_id text,
  _stage_id text,
  _event_id uuid,
  _activated_at timestamptz default now()
)
returns table (
  work_item_id uuid,
  agent_task_id uuid,
  reused_work_item boolean,
  reused_task boolean,
  reopened boolean,
  legacy_reconciled boolean,
  activation_count integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  _candidate public.ema_candidates%rowtype;
  _item public.cash_work_items%rowtype;
  _task public.agent_tasks%rowtype;
  _task_id uuid;
  _task_status text;
  _label text;
  _title text;
  _description text;
  _reused_task boolean := false;
  _legacy boolean := false;
  _reopened boolean := false;
  _activation_count integer := 1;
begin
  if not (
    (_work_kind = 'sfr_underwriting'
      and _pipeline_id = 'w3OtDJjCdN840Hwb1fpt'
      and _stage_id = '1c3468f6-1a5d-4025-bf20-2bc4bd195708')
    or
    (_work_kind = 'portfolio_napkin'
      and _pipeline_id = 'K6YsnZw6qhYLvXSvuixD'
      and _stage_id = 'a4c70dff-3832-427f-adb7-a3945a175783')
  ) then
    raise exception 'unsupported_cash_stage_trigger' using errcode = '22023';
  end if;

  if _ghl_opportunity_id is null or length(_ghl_opportunity_id) < 1 or length(_ghl_opportunity_id) > 128 then
    raise exception 'invalid_ghl_opportunity_id' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(_workspace_id::text || ':' || _ghl_opportunity_id || ':' || _work_kind, 0)
  );

  if _candidate_id is not null then
    select * into _candidate
    from public.ema_candidates
    where id = _candidate_id
      and workspace_id = _workspace_id
      and ghl_opportunity_id = _ghl_opportunity_id
    for update;

    if not found then
      raise exception 'candidate_opportunity_mismatch' using errcode = 'P0002';
    end if;
  end if;

  _label := coalesce(
    nullif(trim(_opportunity_label), ''),
    case when _candidate_id is not null then nullif(_candidate.normalized_address, '') else null end,
    _ghl_opportunity_id
  );
  _label := left(_label, 500);

  if _work_kind = 'sfr_underwriting' then
    _title := 'Underwrite: ' || _label;
    _description := 'Cash full SFR underwriting activated by HighLevel stage: Underwriting.';
  else
    _title := 'Napkin: ' || _label;
    _description := 'Cash initial portfolio napkin analysis activated by HighLevel stage: Ready for Napkin.';
  end if;

  select * into _item
  from public.cash_work_items
  where workspace_id = _workspace_id
    and ghl_opportunity_id = _ghl_opportunity_id
    and work_kind = _work_kind
  for update;

  if found then
    if _item.candidate_id is not null and _candidate_id is not null and _item.candidate_id <> _candidate_id then
      raise exception 'cash_work_item_candidate_mismatch' using errcode = 'P0002';
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

    _task_id := _task.id;
    _task_status := _task.status;
    _reopened := _task.status not in ('todo', 'in_progress');

    update public.agent_tasks
    set title = _title,
        description = _description,
        status = case when status = 'in_progress' then 'in_progress' else 'todo' end,
        priority = 'high',
        archived = false,
        created_by = coalesce(created_by, 'ghl_stage_event'),
        context = coalesce(context, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
          'source', 'ghl_stage_event',
          'activation_version', 'v2',
          'activation_mode', 'stage_controlled',
          'activation_status', case when _task.status = 'in_progress' then 'active' else 'queued' end,
          'subject_origin', case when _candidate_id is null then 'manual_ghl' else 'ema_candidate' end,
          'trigger_kind', _work_kind,
          'ema_candidate_id', _candidate_id,
          'ghl_opportunity_id', _ghl_opportunity_id,
          'pipeline_id', _pipeline_id,
          'trigger_stage_id', _stage_id,
          'last_stage_event_id', _event_id,
          'last_activated_at', _activated_at
        )),
        updated_at = now()
    where id = _task_id;

    update public.cash_work_items
    set candidate_id = coalesce(public.cash_work_items.candidate_id, _candidate_id),
        state = case when _task_status = 'in_progress' then 'active' else 'queued' end,
        trigger_pipeline_id = _pipeline_id,
        trigger_stage_id = _stage_id,
        activation_count = public.cash_work_items.activation_count + 1,
        last_activated_at = _activated_at,
        last_event_id = _event_id,
        updated_at = now()
    where id = _item.id
    returning public.cash_work_items.activation_count into _activation_count;

    return query select _item.id, _task_id, true, true, _reopened, false, _activation_count;
    return;
  end if;

  if _candidate_id is not null and _candidate.cash_task_id is not null then
    select * into _task
    from public.agent_tasks
    where id = _candidate.cash_task_id
      and workspace_id = _workspace_id
      and assigned_to = 'cash'
    for update;

    if not found then
      raise exception 'candidate_cash_task_invalid' using errcode = 'P0002';
    end if;

    _task_id := _task.id;
    _task_status := _task.status;
    _reused_task := true;
    _legacy := coalesce(_task.context ->> 'activation_mode', '') <> 'stage_controlled';
    _reopened := _task.status not in ('todo', 'in_progress');

    update public.agent_tasks
    set title = _title,
        description = _description,
        status = case when status = 'in_progress' then 'in_progress' else 'todo' end,
        priority = 'high',
        archived = false,
        context = coalesce(context, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
          'source', 'ghl_stage_event',
          'activation_version', 'v2',
          'activation_mode', 'stage_controlled',
          'activation_status', case when _task.status = 'in_progress' then 'active' else 'queued' end,
          'subject_origin', 'ema_candidate',
          'trigger_kind', _work_kind,
          'ema_candidate_id', _candidate_id,
          'ghl_opportunity_id', _ghl_opportunity_id,
          'pipeline_id', _pipeline_id,
          'trigger_stage_id', _stage_id,
          'last_stage_event_id', _event_id,
          'last_activated_at', _activated_at,
          'legacy_reconciled', true
        )),
        updated_at = now()
    where id = _task_id;
  else
    insert into public.agent_tasks (
      title,
      description,
      assigned_to,
      status,
      priority,
      context,
      created_by,
      workspace_id,
      type,
      archived
    ) values (
      _title,
      _description,
      'cash',
      'todo',
      'high',
      jsonb_strip_nulls(jsonb_build_object(
        'source', 'ghl_stage_event',
        'activation_version', 'v2',
        'activation_mode', 'stage_controlled',
        'activation_status', 'queued',
        'subject_origin', case when _candidate_id is null then 'manual_ghl' else 'ema_candidate' end,
        'trigger_kind', _work_kind,
        'ema_candidate_id', _candidate_id,
        'ghl_opportunity_id', _ghl_opportunity_id,
        'pipeline_id', _pipeline_id,
        'trigger_stage_id', _stage_id,
        'last_stage_event_id', _event_id,
        'last_activated_at', _activated_at
      )),
      'ghl_stage_event',
      _workspace_id,
      'research',
      false
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
    last_event_id
  ) values (
    _workspace_id,
    _candidate_id,
    _ghl_opportunity_id,
    _task_id,
    _work_kind,
    case when _task_status = 'in_progress' then 'active' else 'queued' end,
    _pipeline_id,
    _stage_id,
    1,
    _activated_at,
    _activated_at,
    _event_id
  ) returning id into work_item_id;

  if _candidate_id is not null then
    update public.ema_candidates
    set cash_task_id = _task_id,
        updated_at = now()
    where id = _candidate_id
      and workspace_id = _workspace_id;
  end if;

  agent_task_id := _task_id;
  reused_work_item := false;
  reused_task := _reused_task;
  reopened := _reopened;
  legacy_reconciled := _legacy or _reused_task;
  activation_count := 1;
  return next;
end;
$$;

revoke all on function public.reconcile_cash_stage_trigger_v2(uuid, uuid, text, text, text, text, text, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.reconcile_cash_stage_trigger_v2(uuid, uuid, text, text, text, text, text, uuid, timestamptz) to service_role;
