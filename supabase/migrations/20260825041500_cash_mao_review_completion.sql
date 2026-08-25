-- Cash acquisition underwriting now completes at MAO and hands the durable work
-- item/task to human review. Flip Analysis remains a separate later-stage workflow.

create or replace function public.complete_cash_sfr_acquisition_review(
  _workspace_id uuid,
  _work_item_id uuid,
  _task_id uuid,
  _progress jsonb
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  _current_context jsonb;
begin
  select coalesce(context, '{}'::jsonb)
    into _current_context
  from public.agent_tasks
  where id = _task_id
    and workspace_id = _workspace_id
    and assigned_to = 'cash'
    and status = 'in_progress'
  for update;

  if not found then
    raise exception 'cash_task_not_in_progress';
  end if;

  update public.cash_work_items
  set state = 'review',
      updated_at = now()
  where id = _work_item_id
    and workspace_id = _workspace_id
    and agent_task_id = _task_id
    and work_kind = 'sfr_underwriting'
    and state = 'active';

  if not found then
    raise exception 'cash_work_item_not_active';
  end if;

  update public.agent_tasks
  set status = 'review',
      context = _current_context || jsonb_build_object(
        'cash_runtime_status', 'review',
        'acquisition_underwriting_complete', true,
        'cash_progress', coalesce(_progress, '{}'::jsonb)
      ),
      updated_at = now()
  where id = _task_id
    and workspace_id = _workspace_id
    and assigned_to = 'cash';

  if not found then
    raise exception 'cash_task_review_update_failed';
  end if;

  return true;
end;
$$;

revoke all on function public.complete_cash_sfr_acquisition_review(uuid, uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.complete_cash_sfr_acquisition_review(uuid, uuid, uuid, jsonb) to service_role;

comment on function public.complete_cash_sfr_acquisition_review(uuid, uuid, uuid, jsonb) is
  'Atomically transitions a successful Cash SFR MAO run from active/in_progress to review/review; Flip Analysis is intentionally not auto-run.';
