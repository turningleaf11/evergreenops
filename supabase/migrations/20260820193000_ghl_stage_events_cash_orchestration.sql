-- Phase 3: secure HighLevel stage-event orchestration boundary.
--
-- The public Edge Function verifies HighLevel's Ed25519 signature and then
-- records a narrow event envelope here. Cash work is reconciled by the
-- SECURITY DEFINER function below; callers cannot pass arbitrary tables,
-- SQL, assignees, pipelines, stages, or work kinds.

create table if not exists public.ghl_stage_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  delivery_key text not null,
  provider_event_id text,
  payload_sha256 text not null,
  raw_size_bytes integer not null default 0 check (raw_size_bytes >= 0 and raw_size_bytes <= 65536),
  authenticated boolean not null default false,
  signature_kind text not null default 'ghl_ed25519' check (signature_kind = 'ghl_ed25519'),
  event_type text,
  location_id text,
  opportunity_id text,
  pipeline_id text,
  stage_id text,
  event_timestamp timestamptz,
  decision text not null check (decision = any (array[
    'received'::text,
    'rejected_signature'::text,
    'malformed'::text,
    'ignored_event_type'::text,
    'rejected_location'::text,
    'ignored_wrong_pipeline'::text,
    'ignored_wrong_stage'::text,
    'stale_or_mismatched_opportunity'::text,
    'unknown_opportunity'::text,
    'activated'::text,
    'reconciled'::text,
    'duplicate'::text,
    'failed'::text
  ])),
  candidate_id uuid references public.ema_candidates(id) on delete set null,
  cash_task_id uuid references public.agent_tasks(id) on delete set null,
  raw_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(raw_metadata) = 'object'),
  result_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(result_metadata) = 'object'),
  duplicate_count integer not null default 0 check (duplicate_count >= 0),
  first_received_at timestamptz not null default now(),
  last_received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, delivery_key)
);

create index if not exists ghl_stage_events_workspace_opportunity_idx
  on public.ghl_stage_events(workspace_id, opportunity_id, created_at desc);
create index if not exists ghl_stage_events_candidate_idx
  on public.ghl_stage_events(candidate_id, created_at desc)
  where candidate_id is not null;

alter table public.ghl_stage_events enable row level security;
revoke all on table public.ghl_stage_events from anon, authenticated;

create table if not exists public.cash_work_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  candidate_id uuid not null references public.ema_candidates(id) on delete cascade,
  ghl_opportunity_id text not null,
  agent_task_id uuid not null references public.agent_tasks(id) on delete restrict,
  work_kind text not null check (work_kind = any (array[
    'sfr_underwriting'::text,
    'portfolio_napkin'::text
  ])),
  state text not null default 'queued' check (state = any (array[
    'queued'::text,
    'active'::text,
    'review'::text,
    'completed'::text,
    'blocked'::text
  ])),
  trigger_pipeline_id text not null,
  trigger_stage_id text not null,
  activation_count integer not null default 1 check (activation_count >= 1),
  first_activated_at timestamptz not null default now(),
  last_activated_at timestamptz not null default now(),
  last_event_id uuid references public.ghl_stage_events(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, ghl_opportunity_id, work_kind),
  unique (agent_task_id)
);

create index if not exists cash_work_items_candidate_idx
  on public.cash_work_items(workspace_id, candidate_id);

alter table public.cash_work_items enable row level security;
revoke all on table public.cash_work_items from anon, authenticated;

create or replace function public.reconcile_cash_stage_trigger(
  _workspace_id uuid,
  _candidate_id uuid,
  _ghl_opportunity_id text,
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
  -- Defense in depth: this RPC accepts only the two Phase 3 trigger pairs.
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

  -- Serialize all work-item reconciliation for a deal/work kind, including
  -- distinct webhook deliveries that arrive concurrently.
  perform pg_advisory_xact_lock(
    hashtextextended(_workspace_id::text || ':' || _ghl_opportunity_id || ':' || _work_kind, 0)
  );

  select * into _candidate
  from public.ema_candidates
  where id = _candidate_id
    and workspace_id = _workspace_id
    and ghl_opportunity_id = _ghl_opportunity_id
  for update;

  if not found then
    raise exception 'candidate_opportunity_mismatch' using errcode = 'P0002';
  end if;

  _label := coalesce(nullif(_candidate.normalized_address, ''), _ghl_opportunity_id);
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
        context = coalesce(context, '{}'::jsonb) || jsonb_build_object(
          'source', 'ghl_stage_event',
          'activation_version', 'v1',
          'activation_mode', 'stage_controlled',
          'activation_status', case when _task.status = 'in_progress' then 'active' else 'queued' end,
          'trigger_kind', _work_kind,
          'ema_candidate_id', _candidate_id,
          'ghl_opportunity_id', _ghl_opportunity_id,
          'pipeline_id', _pipeline_id,
          'trigger_stage_id', _stage_id,
          'last_stage_event_id', _event_id,
          'last_activated_at', _activated_at
        ),
        updated_at = now()
    where id = _task_id;

    update public.cash_work_items
    set state = case when _task_status = 'in_progress' then 'active' else 'queued' end,
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

  -- Pre-stage architecture may already have left a Cash task on the candidate.
  -- Reuse that exact task instead of creating a second one.
  if _candidate.cash_task_id is not null then
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
        context = coalesce(context, '{}'::jsonb) || jsonb_build_object(
          'source', 'ghl_stage_event',
          'activation_version', 'v1',
          'activation_mode', 'stage_controlled',
          'activation_status', case when _task.status = 'in_progress' then 'active' else 'queued' end,
          'trigger_kind', _work_kind,
          'ema_candidate_id', _candidate_id,
          'ghl_opportunity_id', _ghl_opportunity_id,
          'pipeline_id', _pipeline_id,
          'trigger_stage_id', _stage_id,
          'last_stage_event_id', _event_id,
          'last_activated_at', _activated_at,
          'legacy_reconciled', true
        ),
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
      jsonb_build_object(
        'source', 'ghl_stage_event',
        'activation_version', 'v1',
        'activation_mode', 'stage_controlled',
        'activation_status', 'queued',
        'trigger_kind', _work_kind,
        'ema_candidate_id', _candidate_id,
        'ghl_opportunity_id', _ghl_opportunity_id,
        'pipeline_id', _pipeline_id,
        'trigger_stage_id', _stage_id,
        'last_stage_event_id', _event_id,
        'last_activated_at', _activated_at
      ),
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

  update public.ema_candidates
  set cash_task_id = _task_id,
      updated_at = now()
  where id = _candidate_id
    and workspace_id = _workspace_id;

  agent_task_id := _task_id;
  reused_work_item := false;
  reused_task := _reused_task;
  reopened := _reopened;
  legacy_reconciled := _legacy or _reused_task;
  activation_count := 1;
  return next;
end;
$$;

revoke all on function public.reconcile_cash_stage_trigger(uuid, uuid, text, text, text, text, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.reconcile_cash_stage_trigger(uuid, uuid, text, text, text, text, uuid, timestamptz) to service_role;

-- Quarantine the known pre-stage 2627 Cash task. It remains linked to the
-- candidate, but cannot run before the CRM reaches the stage trigger. The RPC
-- above will reopen and upgrade this same task when the valid stage event arrives.
update public.agent_tasks t
set status = 'blocked',
    context = coalesce(t.context, '{}'::jsonb) || jsonb_build_object(
      'legacy_pre_stage_task', true,
      'activation_mode', 'stage_controlled',
      'activation_status', 'awaiting_trigger_stage',
      'legacy_candidate_id', 'fcec7026-4bfc-4860-a80c-465e83584a93'
    ),
    notes = case
      when coalesce(t.notes, '') like '%Phase 3 stage-controlled activation%' then t.notes
      else concat_ws(E'\n', nullif(t.notes, ''), 'Phase 3 stage-controlled activation: quarantined until a valid HighLevel trigger-stage event.')
    end,
    updated_at = now()
where t.id = '4cb30f1c-11de-443f-bf53-68fbf67354f9'::uuid
  and t.workspace_id = 'a8938ed0-9c4e-4d42-b874-593b4b3c90a9'::uuid
  and t.assigned_to = 'cash'
  and exists (
    select 1
    from public.ema_candidates c
    where c.id = 'fcec7026-4bfc-4860-a80c-465e83584a93'::uuid
      and c.workspace_id = t.workspace_id
      and c.cash_task_id = t.id
      and c.ghl_opportunity_id = '6iUCZzKaALAbHRY0Vt4w'
  );
