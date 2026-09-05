-- Books: sweep internal transfers.
--
-- Nearly half the bank rows are Autumn moving her own money between her own
-- Mercury sub-accounts. None of it is income or expense, but it is not nothing
-- either: each transfer moves cash from one account to another, and both
-- accounts are on the same balance sheet, so the ledger has to record it or the
-- per-account balances drift.
--
-- Mercury labels these exactly - bank_description is "Transfer between your
-- Mercury accounts" and the description carries the counterparty's last four -
-- so none of this is guesswork. That matters: an earlier attempt at pairing on
-- amount and date alone misread an ordinary vendor payment as a transfer,
-- because Mercury's send-money boilerplate looks similar. This keys on the
-- label and the account number, and nothing else.
--
-- Every transfer appears twice, once in each account's export. Posting both
-- would record the movement twice, so the pair is posted as one entry and both
-- rows are marked accepted against it.
--
-- Where two identical transfers happen between the same two accounts on the
-- same day, the pairing is genuinely ambiguous. Those are held for review
-- rather than matched arbitrarily - a wrong pairing nets to the same cash but
-- attributes the wrong dates, and quietly.

create or replace function public.book_transfer_candidates()
returns table (
  txn_id uuid,
  entity_id uuid,
  bank_account_id uuid,
  cp_bank_account_id uuid,
  cp_entity_id uuid,
  amount numeric,
  txn_date date
)
language sql stable security invoker set search_path = public, pg_temp as $fn$
  select t.id, t.entity_id, t.bank_account_id, b.id, b.entity_id, t.amount, t.txn_date
  from public.book_transactions t
  join public.book_bank_accounts b
    on b.last_four = substring(t.description from 'xx(\d{4})')
   and b.workspace_id = t.workspace_id
  where t.review_state = 'unreviewed'
    and t.status <> 'failed'
    and t.bank_description = 'Transfer between your Mercury accounts'
$fn$;

create or replace function public.book_post_internal_transfers(_dry_run boolean default false)
returns table (action text, detail text, txn_id uuid, sibling_id uuid, amount numeric)
language plpgsql security invoker set search_path = public, pg_temp as $fn$
declare
  _r record;
  _entry_id uuid;
  _from_gl uuid;
  _to_gl uuid;
begin
  for _r in
    -- The negative side drives, so each pair is visited once rather than twice.
    with c as (select * from public.book_transfer_candidates())
    select a.*, s.sibling_id, s.siblings,
           (select display_name from public.book_bank_accounts where id = a.bank_account_id) as from_name,
           (select display_name from public.book_bank_accounts where id = a.cp_bank_account_id) as to_name
    from c a
    join lateral (
      select count(*) as siblings, (array_agg(b.txn_id order by b.txn_id))[1] as sibling_id
      from c b
      where b.bank_account_id = a.cp_bank_account_id
        and b.cp_bank_account_id = a.bank_account_id
        and b.amount = -a.amount
        and abs(b.txn_date - a.txn_date) <= 1
    ) s on true
    where a.amount < 0
    order by a.txn_date
  loop
    if _r.siblings <> 1 then
      action := case when _r.siblings = 0 then 'no_sibling' else 'ambiguous' end;
      detail := case
        when _r.siblings = 0 then 'The matching row is not in the ledger - import the other account, then run this again.'
        else _r.siblings || ' identical transfers between the same two accounts on the same day; pair them by hand.'
      end;
      txn_id := _r.txn_id; sibling_id := null; amount := _r.amount;
      if not _dry_run then
        -- Flag every row in the unresolved group, not just this one. A candidate
        -- left `unreviewed` would be picked up later by a rule or the classifier
        -- and booked as income or expense, which is the one outcome a transfer
        -- must never have.
        update public.book_transactions
           set review_state = 'needs_review', suggested_by = 'rule', ai_reasoning = detail
         where id = _r.txn_id
            or id in (
                 select c.txn_id from public.book_transfer_candidates() c
                 where c.bank_account_id = _r.cp_bank_account_id
                   and c.cp_bank_account_id = _r.bank_account_id
                   and c.amount = -_r.amount
                   and abs(c.txn_date - _r.txn_date) <= 1
               );
      end if;
      return next;
      continue;
    end if;

    if _r.cp_entity_id <> _r.entity_id then
      -- Two entities, two sets of books, and a real obligation between them.
      -- Not this function's job: use book_post_intercompany, with a human
      -- naming which entity the money was actually for.
      action := 'intercompany';
      detail := _r.from_name || ' -> ' || _r.to_name || ' crosses entities; post the due-to/due-from pair by hand.';
      txn_id := _r.txn_id; sibling_id := _r.sibling_id; amount := _r.amount;
      if not _dry_run then
        update public.book_transactions
           set review_state = 'needs_review', suggested_by = 'rule', ai_reasoning = detail
         where id in (_r.txn_id, _r.sibling_id);
      end if;
      return next;
      continue;
    end if;

    action := case when _dry_run then 'would_post' else 'posted' end;
    detail := _r.from_name || ' -> ' || _r.to_name;
    txn_id := _r.txn_id; sibling_id := _r.sibling_id; amount := _r.amount;

    if not _dry_run then
      select gl_account_id into _from_gl from public.book_bank_accounts where id = _r.bank_account_id;
      select gl_account_id into _to_gl   from public.book_bank_accounts where id = _r.cp_bank_account_id;

      insert into public.book_journal_entries
        (workspace_id, entity_id, entry_date, memo, source, transaction_id)
      select t.workspace_id, _r.entity_id, _r.txn_date, detail, 'bank', _r.txn_id
      from public.book_transactions t where t.id = _r.txn_id
      returning id into _entry_id;

      insert into public.book_journal_lines
        (workspace_id, entry_id, account_id, debit, credit, memo, line_no)
      select t.workspace_id, _entry_id, _to_gl, abs(_r.amount), 0, detail, 1
      from public.book_transactions t where t.id = _r.txn_id;

      insert into public.book_journal_lines
        (workspace_id, entry_id, account_id, debit, credit, memo, line_no)
      select t.workspace_id, _entry_id, _from_gl, 0, abs(_r.amount), detail, 2
      from public.book_transactions t where t.id = _r.txn_id;

      -- Both sides are settled by the one entry; neither should come back.
      update public.book_transactions
         set review_state = 'accepted', suggested_by = 'rule',
             review_note = 'Internal transfer: ' || detail
       where id in (_r.txn_id, _r.sibling_id);
    end if;

    return next;
  end loop;
end
$fn$;

grant execute on function public.book_transfer_candidates() to authenticated;
grant execute on function public.book_post_internal_transfers(boolean) to authenticated;
