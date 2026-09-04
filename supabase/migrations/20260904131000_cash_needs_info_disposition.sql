-- Cash SFR needs-info disposition.
--
-- A durable CashValue/Rehab `needs_info` result is a terminal disposition for
-- the current HighLevel Underwriting activation. It must release the worker so
-- Cash can continue to another live activation instead of reacquiring the same
-- incomplete deal. A genuine later GHL re-entry creates a new activation_count
-- and may reopen the same durable envelope.

create or replace function public.block_cash_sfr_needs_info_work_item(
  _workspace_id uuid,
  _work_item_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  _item public.cash_work_items%rowtype;
  _step record;
  _reason text;
begin
  select * into _item
  from public.cash_work_items
  where id = _work_item_id
    and workspace_id = _workspace_id
    and work_kind = 'sfr_underwriting'
    and state = 'active'
  for update;

  if not found then
    return false;
  end if;

  select s.id, s.phase, s.updated_at
    into _step
  from public.cash_underwriting_steps s
  where s.workspace_id = _workspace_id
    and s.cash_work_item_id = _item.id
    and s.activation_count = _item.activation_count
    and s.status = 'needs_info'
    and s.phase in ('cash_value', 'rehab')
  order by s.updated_at desc,
           case s.phase when 'rehab' then 2 else 1 end desc,
           s.id desc
  limit 1;

  if not found then
    return false;
  end if;

  _reason := _step.phase || '_needs_info';

  update public.cash_work_items
  set state = 'blocked',
      claim_lease_token = null,
      claim_lease_expires_at = null,
      updated_at = now()
  where id = _item.id;

  update public.agent_tasks
  set status = 'blocked',
      context = coalesce(context, '{}'::jsonb) || jsonb_build_object(
        'cash_runtime_status', 'blocked',
        'cash_block_reason', _reason,
        'cash_block_phase', _step.phase,
        'cash_blocked_at', now(),
        'cash_block_source', 'underwriting_needs_info',
        'cash_needs_info_step_id', _step.id
      ),
      updated_at = now()
  where id = _item.agent_task_id
    and workspace_id = _workspace_id
    and assigned_to = 'cash';

  -- The current activation has been consumed but cannot advance. Mark only this
  -- activation signal stale so the JIT worker will not reopen the same activation.
  -- A later GHL stage re-entry receives a higher activation_count and remains eligible.
  update public.cash_activation_signals
  set state = 'stale',
      stale_at = now(),
      stale_reason = _reason,
      cash_work_item_id = _item.id,
      updated_at = now()
  where workspace_id = _workspace_id
    and ghl_opportunity_id = _item.ghl_opportunity_id
    and activation_count = _item.activation_count
    and state in ('pending', 'claimed');

  return true;
end;
$$;

revoke all on function public.block_cash_sfr_needs_info_work_item(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.block_cash_sfr_needs_info_work_item(uuid, uuid)
  to service_role;

create or replace function public.block_cash_sfr_needs_info_from_step()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.block_cash_sfr_needs_info_work_item(
    new.workspace_id,
    new.cash_work_item_id
  );
  return new;
end;
$$;

revoke all on function public.block_cash_sfr_needs_info_from_step()
  from public, anon, authenticated;

drop trigger if exists trg_block_cash_sfr_needs_info_from_step
  on public.cash_underwriting_steps;
create trigger trg_block_cash_sfr_needs_info_from_step
  after insert or update of status, phase, activation_count
  on public.cash_underwriting_steps
  for each row
  when (
    new.status = 'needs_info'
    and new.phase in ('cash_value', 'rehab')
  )
  execute function public.block_cash_sfr_needs_info_from_step();

-- The Gateway persists task progress immediately after persisting the underwriting
-- step. If the step trigger just blocked the task, do not let that later progress
-- write relabel the runtime context as active. On a genuine re-entry, the JIT claim
-- explicitly changes the task back to in_progress; remove the old needs-info block
-- metadata at that point.
create or replace function public.preserve_cash_needs_info_task_disposition()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.assigned_to = 'cash'
    and old.status = 'blocked'
    and coalesce(old.context ->> 'cash_block_source', '') = 'underwriting_needs_info' then

    if new.status = 'blocked' then
      new.context := coalesce(new.context, '{}'::jsonb) || jsonb_build_object(
        'cash_runtime_status', 'blocked',
        'cash_block_reason', old.context ->> 'cash_block_reason',
        'cash_block_phase', old.context ->> 'cash_block_phase',
        'cash_blocked_at', old.context -> 'cash_blocked_at',
        'cash_block_source', 'underwriting_needs_info',
        'cash_needs_info_step_id', old.context -> 'cash_needs_info_step_id'
      );
    elsif new.status = 'in_progress' then
      new.context := (
        coalesce(new.context, '{}'::jsonb)
        - 'cash_block_reason'
        - 'cash_block_phase'
        - 'cash_blocked_at'
        - 'cash_block_source'
        - 'cash_needs_info_step_id'
      ) || jsonb_build_object('cash_runtime_status', 'active');
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.preserve_cash_needs_info_task_disposition()
  from public, anon, authenticated;

drop trigger if exists trg_preserve_cash_needs_info_task_disposition
  on public.agent_tasks;
create trigger trg_preserve_cash_needs_info_task_disposition
  before update of status, context
  on public.agent_tasks
  for each row
  execute function public.preserve_cash_needs_info_task_disposition();

-- Heal any pre-existing active SFR activation that already persisted needs_info
-- before this migration. This is a runtime-safety reconciliation, not a blanket
-- legacy-queue cleanup.
do $$
declare
  _row record;
begin
  for _row in
    select distinct w.workspace_id, w.id
    from public.cash_work_items w
    join public.cash_underwriting_steps s
      on s.cash_work_item_id = w.id
     and s.activation_count = w.activation_count
    where w.work_kind = 'sfr_underwriting'
      and w.state = 'active'
      and s.status = 'needs_info'
      and s.phase in ('cash_value', 'rehab')
  loop
    perform public.block_cash_sfr_needs_info_work_item(
      _row.workspace_id,
      _row.id
    );
  end loop;
end;
$$;