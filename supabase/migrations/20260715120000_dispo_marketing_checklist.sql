-- Per-deal marketing checklist (grouped, editable). Seeded in the app from
-- DEFAULT_MARKETING_CHECKLIST the first time a deal's Marketing phase is opened.
-- Shape: [{ cat: text, items: [{ label: text, done: bool }] }]
alter table public.dispo_deal_details
  add column if not exists marketing_checklist jsonb;
