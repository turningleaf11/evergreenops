-- Per-deal editable marketing checklist (grouped items), seeded from a default
-- template on first use. Stored as jsonb so add/remove/reorder is trivial.
alter table public.dispo_deal_details add column if not exists marketing_checklist jsonb;;
