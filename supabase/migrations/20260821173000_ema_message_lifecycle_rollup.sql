-- Keep Ema's durable Gmail message state aligned with candidate progress.
-- This makes overlapping hourly inbox scans retry-safe without relying on model memory.

create or replace function public.ema_apply_buy_box_processing_status()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  -- Respect an explicit processing_status supplied by the application. Only
  -- derive the candidate state when buy-box code changes the verdict without
  -- also setting a lifecycle state itself.
  if new.buy_box_fit_result is distinct from old.buy_box_fit_result
     and new.processing_status is not distinct from old.processing_status
     and old.processing_status not in ('ghl_pending', 'completed') then
    new.processing_status := case new.buy_box_fit_result
      when 'fit' then 'screen_passed'
      when 'needs_info' then 'screen_needs_info'
      when 'not_fit' then 'screen_failed'
      else new.processing_status
    end;
  end if;

  return new;
end;
$$;

revoke all on function public.ema_apply_buy_box_processing_status() from public;
revoke all on function public.ema_apply_buy_box_processing_status() from anon;
revoke all on function public.ema_apply_buy_box_processing_status() from authenticated;

drop trigger if exists ema_candidates_apply_buy_box_processing_status on public.ema_candidates;
create trigger ema_candidates_apply_buy_box_processing_status
before update of buy_box_fit_result on public.ema_candidates
for each row
execute function public.ema_apply_buy_box_processing_status();

create or replace function public.ema_rollup_message_processing_status()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  target_message_id uuid;
  candidate_count integer;
  terminal_count integer;
  error_count integer;
  next_status text;
begin
  -- This trigger is only installed for INSERT/UPDATE, so NEW is always valid.
  target_message_id := new.ema_message_id;

  select
    count(*)::integer,
    count(*) filter (
      where processing_status in ('completed', 'intake_excluded', 'screen_failed')
    )::integer,
    count(*) filter (where processing_status = 'error')::integer
  into candidate_count, terminal_count, error_count
  from public.ema_candidates
  where ema_message_id = target_message_id;

  if candidate_count = 0 then
    return null;
  end if;

  next_status := case
    when error_count > 0 then 'error'
    when terminal_count = candidate_count then 'completed'
    when terminal_count > 0 then 'partially_processed'
    else 'extracted'
  end;

  update public.ema_messages
  set processing_status = next_status
  where id = target_message_id
    -- A source-level exclusion represents a message intentionally classified as
    -- irrelevant before candidate creation. Never reopen it via roll-up.
    and processing_status <> 'excluded'
    and processing_status is distinct from next_status;

  return null;
end;
$$;

revoke all on function public.ema_rollup_message_processing_status() from public;
revoke all on function public.ema_rollup_message_processing_status() from anon;
revoke all on function public.ema_rollup_message_processing_status() from authenticated;

drop trigger if exists ema_candidates_rollup_message_processing_status on public.ema_candidates;
create trigger ema_candidates_rollup_message_processing_status
after insert or update on public.ema_candidates
for each row
execute function public.ema_rollup_message_processing_status();

-- Backfill candidate lifecycle values that predate the automatic buy-box state
-- derivation. Do not downgrade candidates already in CRM write/completed states.
update public.ema_candidates
set processing_status = case buy_box_fit_result
  when 'fit' then 'screen_passed'
  when 'needs_info' then 'screen_needs_info'
  when 'not_fit' then 'screen_failed'
  else processing_status
end
where buy_box_fit_result in ('fit', 'needs_info', 'not_fit')
  and processing_status in ('extracted', 'screen_pending');

-- Backfill existing message lifecycle state so the first hourly automation run
-- starts from durable truth rather than stale historical `extracted` values.
with candidate_rollup as (
  select
    ema_message_id,
    count(*)::integer as candidate_count,
    count(*) filter (
      where processing_status in ('completed', 'intake_excluded', 'screen_failed')
    )::integer as terminal_count,
    count(*) filter (where processing_status = 'error')::integer as error_count
  from public.ema_candidates
  group by ema_message_id
), resolved as (
  select
    ema_message_id,
    case
      when error_count > 0 then 'error'
      when terminal_count = candidate_count then 'completed'
      when terminal_count > 0 then 'partially_processed'
      else 'extracted'
    end as processing_status
  from candidate_rollup
  where candidate_count > 0
)
update public.ema_messages m
set processing_status = r.processing_status
from resolved r
where m.id = r.ema_message_id
  and m.processing_status <> 'excluded'
  and m.processing_status is distinct from r.processing_status;
