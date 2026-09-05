-- Books: the rules engine.
--
-- A rule is a promise: "whenever this text shows up, book it here." It exists so
-- the same twelve payees never have to be categorised twice. Rules run first and
-- the classifier only sees what is left, which is what keeps the AI bill small
-- and the ledger predictable.
--
-- The treatments are the ones book_rules already declares, plus 'exclude':
--   post         - book it straight to the ledger. Only ever set deliberately.
--   review       - fill in the answer but stop, so a human presses the button.
--   transfer     - my own money moving between my own accounts; not an event.
--   exclude      - noise that is not a business event at all.
--   intercompany - one entity paid for another. Held for review on purpose:
--                  it writes to two sets of books, and a text match is not
--                  enough evidence to touch a second entity's ledger.
--
-- Nothing here invents an amount. A rule either names fixed amounts that must
-- sum to the transaction exactly, or names percentages that are resolved against
-- whatever actually moved. Anything that does not add up is refused and the
-- transaction lands in the review queue with the reason attached.

-- Percent splits are how a rule survives a changing amount.
alter table public.book_rules
  add column if not exists confidence numeric(4,3) not null default 0.900;

-- 'exclude' for noise that is neither a transfer nor a business event, and
-- 'memo' because Mercury's note field is often the only place a payee is named.
alter table public.book_rules drop constraint if exists book_rules_treatment_check;
alter table public.book_rules add constraint book_rules_treatment_check
  check (treatment in ('post', 'review', 'transfer', 'intercompany', 'exclude'));
alter table public.book_rules drop constraint if exists book_rules_match_field_check;
alter table public.book_rules add constraint book_rules_match_field_check
  check (match_field in ('description', 'bank_description', 'memo', 'both'));

comment on column public.book_rules.splits is
  'Array of {account_id, amount|percent, partner_id?, memo?}. Percent resolves against the transaction amount; fixed amounts must sum to it exactly.';

-- ilike patterns are written by a human, not a programmer: % and _ in a payee
-- name are literal characters, not wildcards.
create or replace function public.book_rule_escape(_p text)
returns text language sql immutable set search_path = public, pg_temp as $fn$
  select replace(replace(replace(coalesce(_p,''), '\', '\\'), '%', '\%'), '_', '\_')
$fn$;

-- The single place that decides which rule owns a transaction. Lowest priority
-- wins; ties break on age, so an older rule keeps its claim.
create or replace function public.book_match_rule(_txn_id uuid)
returns uuid language sql stable set search_path = public, pg_temp as $fn$
  select r.id
  from public.book_transactions t
  join public.book_rules r
    on r.is_active
   and r.workspace_id = t.workspace_id
   and (r.entity_id is null or r.entity_id = t.entity_id)
   and (case r.match_field
          when 'bank_description' then coalesce(t.bank_description, '')
          when 'memo'             then coalesce(t.memo, '')
          when 'both'             then concat_ws(' ', t.description, t.bank_description)
          else coalesce(t.description, '')
        end) ilike '%' || public.book_rule_escape(r.match_pattern) || '%' escape '\'
  where t.id = _txn_id
  order by r.priority, r.created_at
  limit 1
$fn$;

-- Turn a rule's splits into concrete amounts for one transaction. Percentages
-- are resolved against the gross, and any rounding residue is pushed onto the
-- last line so the total is exact to the cent rather than nearly right.
create or replace function public.book_resolve_splits(_rule_id uuid, _gross numeric)
returns jsonb language plpgsql stable set search_path = public, pg_temp as $fn$
declare
  _splits jsonb;
  _out jsonb := '[]'::jsonb;
  _s jsonb;
  _amt numeric;
  _running numeric := 0;
  _n int := 0;
  _count int;
begin
  select splits into _splits from public.book_rules where id = _rule_id;
  _count := jsonb_array_length(coalesce(_splits, '[]'::jsonb));
  if _count = 0 then
    raise exception 'Rule % has no splits to apply.', _rule_id;
  end if;

  for _s in select * from jsonb_array_elements(_splits) loop
    _n := _n + 1;
    if _s ? 'percent' then
      _amt := round(_gross * (_s->>'percent')::numeric / 100, 2);
    elsif _s ? 'amount' then
      _amt := round((_s->>'amount')::numeric, 2);
    else
      raise exception 'Split % of rule % names neither an amount nor a percent.', _n, _rule_id;
    end if;

    -- Last line absorbs the rounding, but only for percentage rules; a fixed
    -- rule that does not add up is a mistake and has to be seen, not patched.
    if _n = _count and (_s ? 'percent') then
      _amt := round(_gross - _running, 2);
    end if;
    _running := _running + _amt;

    _out := _out || jsonb_build_object(
      'account_id', _s->>'account_id',
      'amount', _amt,
      'partner_id', _s->>'partner_id',
      'memo', _s->>'memo');
  end loop;

  return _out;
end
$fn$;

-- Run the rules over the unreviewed queue. Returns a row per transaction it
-- touched, so the caller can show exactly what happened rather than a count.
create or replace function public.book_apply_rules(
  _entity_id uuid default null,
  _limit int default 500,
  _dry_run boolean default false
)
returns table (txn_id uuid, rule_id uuid, action text, detail text)
language plpgsql security invoker set search_path = public, pg_temp as $fn$
declare
  _t record;
  _r record;
  _splits jsonb;
  _msg text;
begin
  for _t in
    select id, entity_id, amount, description
    from public.book_transactions
    where review_state = 'unreviewed'
      and status <> 'failed'
      and (_entity_id is null or entity_id = _entity_id)
    order by txn_date
    limit greatest(coalesce(_limit, 500), 0)
  loop
    select * into _r from public.book_rules where id = public.book_match_rule(_t.id);
    continue when _r.id is null;

    txn_id := _t.id;
    rule_id := _r.id;

    if _r.treatment in ('transfer', 'exclude') then
      action := case when _r.treatment = 'transfer' then 'transfer' else 'excluded' end;
      detail := coalesce(_r.note, case when _r.treatment = 'transfer'
                                       then 'My own money moving between my own accounts.'
                                       else 'Excluded by rule.' end);
      if not _dry_run then
        update public.book_transactions
           set review_state = 'excluded',
               review_note = detail,
               suggested_by = 'rule',
               confidence = _r.confidence
         where id = _t.id;
      end if;
      return next;

    elsif _r.treatment in ('review', 'intercompany') then
      action := case when _r.treatment = 'intercompany' then 'intercompany_held' else 'suggested' end;
      detail := coalesce(_r.note, case when _r.treatment = 'intercompany'
                                       then 'One entity paid for another - post the pair by hand.'
                                       else 'Matched a rule; needs a look before posting.' end);
      if not _dry_run then
        update public.book_transactions
           set review_state = 'needs_review',
               suggested_by = 'rule',
               confidence = _r.confidence,
               ai_reasoning = detail
         where id = _t.id;
      end if;
      return next;

    else
      begin
        _splits := public.book_resolve_splits(_r.id, abs(_t.amount));
        if _dry_run then
          action := 'would_post';
          detail := _splits::text;
        else
          -- source stays 'bank': it describes where the entry came from in
          -- accounting terms, not who categorised it. That a rule did the
          -- categorising is recorded on the transaction, below.
          perform public.book_post_transaction(_t.id, _splits, _r.note, 'bank');
          -- The balance trigger is deferred to commit, which would put the
          -- failure out of this block's reach. Force it now so a bad rule costs
          -- one transaction rather than the whole run.
          set constraints public.book_journal_lines_balance immediate;
          -- and straight back, or every later line in this run would be
          -- checked the moment it lands, before its partner exists.
          set constraints public.book_journal_lines_balance deferred;
          update public.book_transactions
             set suggested_by = 'rule', confidence = _r.confidence
           where id = _t.id;
          action := 'posted';
          detail := coalesce(_r.note, _r.match_pattern);
        end if;
      exception when others then
        get stacked diagnostics _msg = message_text;
        action := 'held';
        detail := _msg;
        if not _dry_run then
          -- A rule that cannot post is not a reason to lose the transaction.
          update public.book_transactions
             set review_state = 'needs_review',
                 suggested_by = 'rule',
                 ai_reasoning = 'Rule "' || _r.match_pattern || '" could not post: ' || _msg
           where id = _t.id;
        end if;
      end;
      return next;
    end if;

    if not _dry_run then
      update public.book_rules
         set hit_count = hit_count + 1, last_hit_at = now()
       where id = _r.id;
    end if;
  end loop;
end
$fn$;

-- How much of the queue a rule would claim, before you trust it with 'post'.
create or replace function public.book_rule_preview(_rule_id uuid, _limit int default 25)
returns table (txn_id uuid, txn_date date, description text, amount numeric)
language sql stable security invoker set search_path = public, pg_temp as $fn$
  select t.id, t.txn_date, t.description, t.amount
  from public.book_transactions t
  join public.book_rules r on r.id = _rule_id
  where t.workspace_id = r.workspace_id
    and t.status <> 'failed'
    and (r.entity_id is null or r.entity_id = t.entity_id)
    and (case r.match_field
           when 'bank_description' then coalesce(t.bank_description, '')
           when 'memo'             then coalesce(t.memo, '')
           when 'both'             then concat_ws(' ', t.description, t.bank_description)
           else coalesce(t.description, '')
         end) ilike '%' || public.book_rule_escape(r.match_pattern) || '%' escape '\'
  order by t.txn_date desc
  limit greatest(coalesce(_limit, 25), 0)
$fn$;

grant execute on function public.book_apply_rules(uuid, int, boolean) to authenticated;
grant execute on function public.book_rule_preview(uuid, int) to authenticated;
grant execute on function public.book_match_rule(uuid) to authenticated;
grant execute on function public.book_resolve_splits(uuid, numeric) to authenticated;
grant execute on function public.book_rule_escape(text) to authenticated;
