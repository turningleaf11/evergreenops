-- 1109 Riviera: 2025 is a disposition year, not a rental year.
--
-- The property was acquired subject-to (the loan stayed in the seller's name)
-- and sold in November 2025 through Title Guaranty of South Florida. That makes
-- the year a Form 4797 disposition, and it makes the never-recorded
-- depreciation urgent rather than tidy: on a sale, "allowed or allowable"
-- reduces basis whether or not depreciation was claimed, so without a Form 3115
-- catch-up the gain is taxed on depreciation that was never taken.
--
-- Two accounts here are deliberately clearing accounts. The cash amounts are
-- known exactly; the allocations are not, and will not be until the purchase
-- and sale closing statements are in hand. Parking them keeps the balance sheet
-- truthful and leaves one adjusting entry to make, rather than spreading a
-- guess across principal, interest and escrow.

do $seed$
declare
  _e uuid;
  _ws uuid;
begin
  select id, workspace_id into _e, _ws from public.book_entities where name = '1109 Riviera';
  if _e is null then
    raise notice '1109 Riviera not found; nothing to seed.';
    return;
  end if;

  insert into public.book_accounts (workspace_id, entity_id, code, name, account_type, subtype)
  select _ws, _e, v.code, v.name, v.atype, v.subtype
  from (values
    ('1350', 'Settlement Clearing - Sale of 1109',        'asset',   'other_current'),
    ('1360', 'Mortgage Payments - Pending Allocation',    'asset',   'other_current'),
    ('4800', 'Gain (Loss) on Sale of Property',           'income',  null),
    ('5300', 'Selling Costs - Commissions & Closing',     'expense', 'cogs')
  ) as v(code, name, atype, subtype)
  where not exists (
    select 1 from public.book_accounts a where a.entity_id = _e and a.code = v.code
  );

  update public.book_entities
     set final_tax_year = 2025
   where id = _e and final_tax_year is distinct from 2025;
end $seed$;
