-- Books: the posting engine.
--
-- Turns a categorised bank row into a balanced journal entry. The caller names
-- only the non-cash side; the cash line is derived from the bank account and
-- the transaction amount. That makes a whole class of mistake impossible: you
-- cannot post splits that do not sum to what actually left the account.
--
--   book_post_transaction    one entity, one or many lines
--   book_post_intercompany   two entities, one economic event, both sides tied
--   book_unpost_transaction  undo, so a wrong call is cheap to fix
--
-- security invoker throughout: these run as the caller, so the CEO-only RLS on
-- the underlying tables still applies. A service_role caller bypasses RLS as it
-- would anywhere, which is why an edge function must check separately.

-- ------------------------------------------------------------------ posting

create or replace function public.book_post_transaction(
  _txn_id uuid,
  _splits jsonb,             -- [{account_id, amount, partner_id?, memo?}, ...]
  _memo   text default null,
  _source text default 'bank'
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare
  _txn      public.book_transactions%rowtype;
  _bank     public.book_bank_accounts%rowtype;
  _entry_id uuid;
  _split    jsonb;
  _total    numeric(14,2) := 0;
  _amt      numeric(14,2);
  _n        integer := 0;
begin
  select * into _txn from public.book_transactions where id = _txn_id;
  if not found then
    raise exception 'Transaction % not found', _txn_id;
  end if;
  if _txn.status = 'failed' then
    raise exception 'Transaction % failed at the bank and never moved money - it must not be posted', _txn_id;
  end if;

  select * into _bank from public.book_bank_accounts where id = _txn.bank_account_id;
  if _bank.gl_account_id is null then
    raise exception 'Bank account % has no cash GL account mapped', _bank.display_name;
  end if;

  if jsonb_typeof(_splits) <> 'array' or jsonb_array_length(_splits) = 0 then
    raise exception 'Splits must be a non-empty JSON array';
  end if;

  -- The splits have to account for the whole bank amount, to the cent.
  for _split in select * from jsonb_array_elements(_splits) loop
    _amt := (_split->>'amount')::numeric(14,2);
    if _amt is null or _amt <= 0 then
      raise exception 'Each split needs a positive amount; got %', coalesce(_split->>'amount','null');
    end if;
    _total := _total + _amt;
    _n := _n + 1;
  end loop;

  if _total <> abs(_txn.amount) then
    raise exception
      'Splits total % but the transaction moved % - the difference is %. Every cent has to be accounted for.',
      _total, abs(_txn.amount), abs(_txn.amount) - _total;
  end if;

  -- One posting per transaction. Unpost first if you are changing it.
  if exists (select 1 from public.book_journal_entries where transaction_id = _txn_id) then
    raise exception 'Transaction % is already posted. Unpost it first.', _txn_id;
  end if;

  insert into public.book_journal_entries
    (workspace_id, entity_id, entry_date, memo, source, transaction_id, created_by)
  values
    (_txn.workspace_id, _txn.entity_id, _txn.txn_date,
     coalesce(_memo, _txn.description), _source, _txn_id, auth.uid())
  returning id into _entry_id;

  -- Money out: the named accounts are debited and cash is credited.
  -- Money in: the reverse.
  _n := 0;
  for _split in select * from jsonb_array_elements(_splits) loop
    _n := _n + 1;
    _amt := (_split->>'amount')::numeric(14,2);
    insert into public.book_journal_lines
      (workspace_id, entry_id, account_id, partner_id, debit, credit, memo, line_no)
    values (
      _txn.workspace_id, _entry_id,
      (_split->>'account_id')::uuid,
      nullif(_split->>'partner_id','')::uuid,
      case when _txn.amount < 0 then _amt else 0 end,
      case when _txn.amount < 0 then 0 else _amt end,
      _split->>'memo', _n);
  end loop;

  insert into public.book_journal_lines
    (workspace_id, entry_id, account_id, debit, credit, memo, line_no)
  values (
    _txn.workspace_id, _entry_id, _bank.gl_account_id,
    case when _txn.amount < 0 then 0 else abs(_txn.amount) end,
    case when _txn.amount < 0 then abs(_txn.amount) else 0 end,
    _bank.display_name, _n + 1);

  update public.book_transactions
     set review_state = 'accepted', reviewed_at = now(), reviewed_by = auth.uid()
   where id = _txn_id;

  return _entry_id;
end;
$fn$;

-- --------------------------------------------------------------- unposting

create or replace function public.book_unpost_transaction(_txn_id uuid)
returns integer
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare _removed integer;
begin
  with gone as (
    delete from public.book_journal_entries
     where transaction_id = _txn_id
        or intercompany_group in (
             select intercompany_group from public.book_journal_entries
              where transaction_id = _txn_id and intercompany_group is not null)
    returning 1)
  select count(*) into _removed from gone;

  update public.book_transactions
     set review_state = 'unreviewed', reviewed_at = null, reviewed_by = null
   where id = _txn_id;

  return _removed;
end;
$fn$;

-- ------------------------------------------------------------ intercompany

-- One economic event, two entities. The paying entity books a receivable
-- against the other; the benefiting entity books the real expense against a
-- payable. Both entries carry the same intercompany_group so the
-- reconciliation can prove the pair rather than infer it from amounts.
create or replace function public.book_post_intercompany(
  _txn_id             uuid,
  _benefiting_entity  uuid,
  _their_account_id   uuid,     -- the expense/asset account on their books
  _memo               text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare
  _txn public.book_transactions%rowtype;
  _bank public.book_bank_accounts%rowtype;
  _grp uuid := gen_random_uuid();
  _due_from uuid; _due_to uuid;
  _e1 uuid; _e2 uuid;
  _amt numeric(14,2);
begin
  select * into _txn from public.book_transactions where id = _txn_id;
  if not found then raise exception 'Transaction % not found', _txn_id; end if;
  if _txn.entity_id = _benefiting_entity then
    raise exception 'Both sides are the same entity - that is an internal transfer, not intercompany';
  end if;

  select * into _bank from public.book_bank_accounts where id = _txn.bank_account_id;
  _amt := abs(_txn.amount);

  select id into _due_from from public.book_accounts
   where entity_id = _txn.entity_id and counterparty_entity_id = _benefiting_entity
     and account_type = 'asset' and is_active;
  select id into _due_to from public.book_accounts
   where entity_id = _benefiting_entity and counterparty_entity_id = _txn.entity_id
     and account_type = 'liability' and is_active;

  if _due_from is null or _due_to is null then
    raise exception 'No due-from/due-to account pair exists between those two entities';
  end if;

  -- Paying entity: receivable up, cash down.
  insert into public.book_journal_entries
    (workspace_id, entity_id, entry_date, memo, source, transaction_id, intercompany_group, created_by)
  values (_txn.workspace_id, _txn.entity_id, _txn.txn_date,
          coalesce(_memo, _txn.description) || ' (paid on behalf of the other entity)',
          'bank', _txn_id, _grp, auth.uid())
  returning id into _e1;

  insert into public.book_journal_lines (workspace_id, entry_id, account_id, debit, credit, line_no) values
    (_txn.workspace_id, _e1, _due_from, _amt, 0, 1),
    (_txn.workspace_id, _e1, _bank.gl_account_id, 0, _amt, 2);

  -- Benefiting entity: the real cost, funded by a payable.
  insert into public.book_journal_entries
    (workspace_id, entity_id, entry_date, memo, source, intercompany_group, created_by)
  values (_txn.workspace_id, _benefiting_entity, _txn.txn_date,
          coalesce(_memo, _txn.description) || ' (funded by the other entity)',
          'manual', _grp, auth.uid())
  returning id into _e2;

  insert into public.book_journal_lines (workspace_id, entry_id, account_id, debit, credit, line_no) values
    (_txn.workspace_id, _e2, _their_account_id, _amt, 0, 1),
    (_txn.workspace_id, _e2, _due_to, 0, _amt, 2);

  update public.book_transactions
     set review_state = 'accepted', reviewed_at = now(), reviewed_by = auth.uid()
   where id = _txn_id;

  return _grp;
end;
$fn$;

grant execute on function public.book_post_transaction(uuid, jsonb, text, text)  to authenticated;
grant execute on function public.book_unpost_transaction(uuid)                   to authenticated;
grant execute on function public.book_post_intercompany(uuid, uuid, uuid, text)  to authenticated;
