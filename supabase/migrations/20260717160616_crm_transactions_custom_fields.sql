-- Deal-level custom field values (keyed by crm_custom_fields.field_key for
-- entity 'deal'). Mirrors the pattern the 'deals' table already uses.
alter table public.crm_transactions
  add column if not exists custom_fields jsonb not null default '{}'::jsonb;;
