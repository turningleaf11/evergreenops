-- Link an OpsHQ deal to its existing GHL opportunity so the close writeback can
-- find + update it (never create). Deals already have an opportunity by the time
-- they reach OpsHQ.
alter table public.crm_transactions
  add column if not exists ghl_opportunity_id text,
  add column if not exists ghl_contact_id text,
  add column if not exists ghl_synced_at timestamptz;

-- Close-routing targets (Closed - Won). Read by the writeback; editable here
-- rather than hard-coded. Dispo (assign/double_close) vs Portfolio (buy_hold).
insert into public.app_settings (key, value) values
  ('GHL_DISPO_PIPELINE_ID',        'iRmZ78SRBCSRO6LeqYpF'),
  ('GHL_DISPO_CLOSED_STAGE_ID',    '81ed59f8-9a26-46a8-a34d-3ad3550ddc60'),
  ('GHL_PORTFOLIO_PIPELINE_ID',    'K6YsnZw6qhYLvXSvuixD'),
  ('GHL_PORTFOLIO_CLOSED_STAGE_ID','fbac9bb6-09cc-4824-9067-f587882dfc5a')
on conflict (key) do nothing;;
