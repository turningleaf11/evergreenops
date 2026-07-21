-- The disposition dropdown offers assign / double_close / buy_hold; the old
-- check only allowed decide/assign/hold. Align it (keep legacy values so any
-- historical rows still validate). NULL passes the check.
alter table public.crm_transactions
  drop constraint if exists crm_transactions_disposition_strategy_check;
alter table public.crm_transactions
  add constraint crm_transactions_disposition_strategy_check
  check (disposition_strategy = any (array['assign','double_close','buy_hold','decide','hold']));
