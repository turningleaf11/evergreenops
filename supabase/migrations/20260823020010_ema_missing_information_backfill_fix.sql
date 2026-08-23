-- Force one real JSONB change so the reconciliation pruning trigger evaluates
-- historical candidates, then remove the temporary key in the same migration.
update public.ema_candidates
set extracted_facts = jsonb_set(
  coalesce(extracted_facts, '{}'::jsonb),
  '{__ema_missing_info_backfill__}',
  'true'::jsonb,
  true
)
where missing_information is not null
  and jsonb_typeof(missing_information) = 'array'
  and jsonb_array_length(missing_information) > 0;

update public.ema_candidates
set extracted_facts = extracted_facts - '__ema_missing_info_backfill__'
where extracted_facts ? '__ema_missing_info_backfill__';
