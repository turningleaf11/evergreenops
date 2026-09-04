-- Cash queue eligibility guard.
--
-- The durable queue can contain work items that were valid when the HighLevel
-- Underwriting-stage webhook fired but are no longer eligible by the time Cash
-- gets an agent turn. It can also contain manually-created GHL opportunities
-- with no Ema candidate. CashValue already rejects non-SFR opportunity records
-- before provider valuation, and the Gateway audit durably records that failure.
--
-- This claim function keeps those conditions out of Cash's autonomous runtime:
--   1. a later authenticated stage event moved the opportunity away from the
--      exact pipeline/stage that activated the work item; or
--   2. the current activation already failed opportunity-source SFR eligibility
--      and has no successful CashValue step.
--
-- In either case the work item/task is quarantined as blocked and the same claim
-- call continues scanning for the next eligible SFR item. Re-entering the valid
-- HighLevel stage reopens the existing durable envelope through the existing
-- reconcile_cash_stage_trigger_v2 path; old failures do not poison a new
-- activation because the audit check is bounded by last_activated_at.

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
  _resumed boolean;
  _phases text[];
  _scan_count integer := 0;
  _block_reason text;
  _block_error_code text;
  _latest_event_id uuid;
  _latest_pipeline_id text;
  _latest_stage_id text;
begin
  loop
    _scan_count := _scan_count + 1;
    if _scan_count > 50 then
      return;
    end if;

    _resumed := false;
    _phases := '{}'::text[];
    _block_reason := null;
    _block_error_code := null;
    _latest_event_id := null;
    _latest_pipeline_id := null;
    _latest_stage_id := null;

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

    select e.id, e.pipeline_id, e.stage_id
      into _latest_event_id, _latest_pipeline_id, _latest_stage_id
    from public.ghl_stage_events e
    where e.workspace_id = _workspace_id
      and e.opportunity_id = _item.ghl_opportunity_id
      and e.authenticated = true
      and e.event_type = 'OpportunityStageUpdate'
    order by e.created_at desc
    limit 1;

    if found
      and _latest_event_id is distinct from _item.last_event_id
      and (
        _latest_pipeline_id is distinct from _item.trigger_pipeline_id
        or _latest_stage_id is distinct from _item.trigger_stage_id
      )
    then
      _block_reason := 'left_trigger_stage';
    end if;

    if _block_reason is null
      and not exists (
        select 1
        from public.cash_underwriting_steps s
        where s.cash_work_item_id = _item.id
          and s.activation_count = _item.activation_count
          and s.phase = 'cash_value'
          and s.status = 'succeeded'
      )
    then
      select a.error_code
        into _block_error_code
      from public.agent_audit_log a
      where a.workspace_id = _workspace_id
        and a.action = 'underwriting.cash_value'
        and a.resource_type = 'ghl_opportunity'
        and a.resource_id = _item.ghl_opportunity_id
        and a.status = 'failed'
        and a.error_code in ('single_family_residence_required', 'sfr_pipeline_required')
        and a.created_at >= _item.last_activated_at
      order by a.created_at desc
      limit 1;

      if found then
        _block_reason := 'sfr_eligibility_failed';
      end if;
    end if;

    if _block_reason is not null then
      update public.cash_work_items
      set state = 'blocked',
          updated_at = now()
      where id = _item.id
        and workspace_id = _workspace_id;

      update public.agent_tasks
      set status = 'blocked',
          context = coalesce(context, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
            'cash_runtime_status', 'blocked',
            'cash_block_reason', _block_reason,
            'cash_block_error_code', _block_error_code,
            'cash_blocked_at', now(),
            'cash_block_source', 'queue_eligibility_guard_v1',
            'cash_latest_stage_event_id', _latest_event_id,
            'cash_latest_pipeline_id', _latest_pipeline_id,
            'cash_latest_stage_id', _latest_stage_id
          )),
          updated_at = now()
      where id = _item.agent_task_id
        and workspace_id = _workspace_id
        and assigned_to = 'cash';

      continue;
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
      and s.status in ('succeeded', 'needs_info');

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
    return;
  end loop;
end;
$$;

revoke all on function public.claim_next_cash_sfr_work_item(uuid) from public, anon, authenticated;
grant execute on function public.claim_next_cash_sfr_work_item(uuid) to service_role;;
