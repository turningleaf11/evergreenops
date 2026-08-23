-- Ema reconciliation hardening after controlled Gmail -> Gateway -> GHL production tests.
--
-- 1. Record the already-live Ema-only intake persistence permission at a migration
--    version that follows the current production head.
-- 2. Keep candidate/message lifecycle state aligned for overlapping hourly scans.
-- 3. Remove resolved source facts from durable missing_information when later
--    Gmail replies provide them.

-- Ema alone may persist new Gmail intake through the controlled Gateway action.
do $$
declare
  ema_agent_id uuid;
begin
  select id into strict ema_agent_id
  from public.agents
  where slug = 'ema';

  delete from public.agent_permissions
  where action = 'deal.persist_email_intake'
    and agent_id <> ema_agent_id;

  insert into public.agent_permissions (
    agent_id, action, enabled, rate_limit_per_minute
  ) values (
    ema_agent_id, 'deal.persist_email_intake', true, 8
  )
  on conflict (agent_id, action) do update
  set enabled = excluded.enabled,
      rate_limit_per_minute = excluded.rate_limit_per_minute;
end $$;

-- When buy-box code changes a verdict without explicitly changing lifecycle
-- state, derive the matching candidate processing status.
create or replace function public.ema_apply_buy_box_processing_status()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
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

-- A later source can resolve facts that were unknown during initial intake.
-- Prune only missing-information entries that clearly map to a now-present fact;
-- preserve arbitrary/human-readable entries that cannot be mapped safely.
create or replace function public.ema_prune_resolved_missing_information()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  item jsonb;
  item_text text;
  normalized_key text;
  resolved boolean;
  remaining jsonb := '[]'::jsonb;
begin
  if new.extracted_facts is not distinct from old.extracted_facts
     or new.missing_information is null
     or jsonb_typeof(new.missing_information) <> 'array' then
    return new;
  end if;

  for item in
    select value from jsonb_array_elements(new.missing_information)
  loop
    if jsonb_typeof(item) <> 'string' then
      remaining := remaining || jsonb_build_array(item);
      continue;
    end if;

    item_text := item #>> '{}';
    normalized_key := lower(regexp_replace(trim(item_text), '[^a-zA-Z0-9]+', '_', 'g'));
    normalized_key := trim(both '_' from normalized_key);
    normalized_key := regexp_replace(
      normalized_key,
      '_(unknown|missing|not_provided|needed|required)$',
      '',
      'g'
    );

    if normalized_key in (
      'repair', 'repairs', 'repair_cost', 'repairs_cost',
      'repairs_estimate', 'rehab_estimate', 'rehab_cost'
    ) then
      normalized_key := 'repair_estimate';
    elsif normalized_key = 'after_repair_value' then
      normalized_key := 'arv';
    end if;

    resolved := new.extracted_facts ? normalized_key
      and jsonb_typeof(new.extracted_facts -> normalized_key) <> 'null'
      and (
        jsonb_typeof(new.extracted_facts -> normalized_key) <> 'string'
        or nullif(trim(new.extracted_facts ->> normalized_key), '') is not null
      );

    if not resolved then
      remaining := remaining || jsonb_build_array(item);
    end if;
  end loop;

  new.missing_information := remaining;
  return new;
end;
$$;

revoke all on function public.ema_prune_resolved_missing_information() from public;
revoke all on function public.ema_prune_resolved_missing_information() from anon;
revoke all on function public.ema_prune_resolved_missing_information() from authenticated;

drop trigger if exists ema_candidates_prune_resolved_missing_information on public.ema_candidates;
create trigger ema_candidates_prune_resolved_missing_information
before update of extracted_facts on public.ema_candidates
for each row
execute function public.ema_prune_resolved_missing_information();

-- Roll child candidate lifecycle into the parent Gmail message. This is what
-- makes an intentional 2-hour lookback safe even when one hourly run is missed.
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

-- Backfill candidate lifecycle values that predate automatic derivation. Do not
-- downgrade candidates already writing to / completed in CRM.
update public.ema_candidates
set processing_status = case buy_box_fit_result
  when 'fit' then 'screen_passed'
  when 'needs_info' then 'screen_needs_info'
  when 'not_fit' then 'screen_failed'
  else processing_status
end
where buy_box_fit_result in ('fit', 'needs_info', 'not_fit')
  and processing_status in ('extracted', 'screen_pending');

-- Backfill missing_information against facts already present today. Touch
-- extracted_facts with an equivalent JSONB value so the BEFORE trigger performs
-- the same conservative pruning logic used for all future reconciliation.
update public.ema_candidates
set extracted_facts = extracted_facts || '{}'::jsonb
where missing_information is not null
  and jsonb_typeof(missing_information) = 'array'
  and jsonb_array_length(missing_information) > 0;

-- Backfill parent-message lifecycle state so completed historical candidates no
-- longer leave the source Gmail message stuck at `extracted`.
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
