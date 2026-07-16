-- The deal's single lifecycle stage (dispo -> handoff -> TC), mirrors the GHL
-- pipeline. next_action is the manual override; readiness is derived in-app.
alter table public.crm_transactions
  add column if not exists stage text default 'prep',
  add column if not exists next_action text;
