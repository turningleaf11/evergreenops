-- Cash JIT re-entry fencing.
--
-- Two invariants are enforced at the database boundary:
-- 1. A newer activation may not replace the activation identity of an active
--    Cash work item while another Cash session still owns an unexpired lease.
-- 2. At most the newest pending activation signal per opportunity remains
--    claimable; older pending signals are marked stale before Cash can work them.

create or replace function public.guard_cash_work_item_activation_under_lease()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.work_kind = 'sfr_underwriting'
    and old.state = 'active'
    and old.claim_lease_expires_at is not null
    and old.claim_lease_expires_at > now()
    and (
      new.activation_count is distinct from old.activation_count
      or new.last_event_id is distinct from old.last_event_id
    ) then
    raise exception 'cash_work_item_activation_lease_active' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_cash_work_item_activation_under_lease()
  from public, anon, authenticated;

drop trigger if exists trg_guard_cash_work_item_activation_under_lease
  on public.cash_work_items;
create trigger trg_guard_cash_work_item_activation_under_lease
  before update of activation_count, last_event_id on public.cash_work_items
  for each row
  execute function public.guard_cash_work_item_activation_under_lease();

create or replace function public.collapse_pending_cash_sfr_activation_signal()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.state <> 'pending' then
    return new;
  end if;

  -- Activation counts are allocated under the per-opportunity advisory lock in
  -- create_cash_sfr_activation_signal. If a lower-count signal is inserted by a
  -- maintenance path, fail closed by staling that older row instead of allowing
  -- two pending activations for the same opportunity.
  if exists (
    select 1
    from public.cash_activation_signals s
    where s.workspace_id = new.workspace_id
      and s.ghl_opportunity_id = new.ghl_opportunity_id
      and s.state = 'pending'
      and s.activation_count > new.activation_count
  ) then
    update public.cash_activation_signals
    set state = 'stale',
        stale_at = coalesce(stale_at, now()),
        stale_reason = 'superseded_activation',
        updated_at = now()
    where id = new.id
      and state = 'pending';
    return new;
  end if;

  update public.cash_activation_signals
  set state = 'stale',
      stale_at = coalesce(stale_at, now()),
      stale_reason = 'superseded_activation',
      updated_at = now()
  where workspace_id = new.workspace_id
    and ghl_opportunity_id = new.ghl_opportunity_id
    and id <> new.id
    and state = 'pending'
    and activation_count < new.activation_count;

  return new;
end;
$$;

revoke all on function public.collapse_pending_cash_sfr_activation_signal()
  from public, anon, authenticated;

drop trigger if exists trg_collapse_pending_cash_sfr_activation_signal
  on public.cash_activation_signals;
create trigger trg_collapse_pending_cash_sfr_activation_signal
  after insert on public.cash_activation_signals
  for each row
  execute function public.collapse_pending_cash_sfr_activation_signal();

-- One-time reconciliation for pending signals that predate this invariant. Keep
-- the highest activation_count per opportunity and preserve every older row as
-- stale history rather than deleting it.
with ranked_pending as (
  select
    s.id,
    row_number() over (
      partition by s.workspace_id, s.ghl_opportunity_id
      order by s.activation_count desc, s.activated_at desc, s.created_at desc, s.id desc
    ) as pending_rank
  from public.cash_activation_signals s
  where s.state = 'pending'
)
update public.cash_activation_signals s
set state = 'stale',
    stale_at = coalesce(s.stale_at, now()),
    stale_reason = 'superseded_activation',
    updated_at = now()
from ranked_pending r
where s.id = r.id
  and r.pending_rank > 1;
