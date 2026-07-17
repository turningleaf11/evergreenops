-- Listing identity: the deal's public marketing name + address privacy for the
-- future inventory site (wholesale protection: show city/state/zip only).
alter table public.crm_transactions
  add column if not exists marketing_title text,
  add column if not exists address_private boolean not null default false;

-- Seed financing custom fields (entity 'deal') per workspace. These render on
-- the deal Summary and carry the SubTo/creative-finance numbers a listing needs
-- (interest rate, PITI, HOA, cash to close). Editable/removable in Settings.
insert into public.crm_custom_fields
  (workspace_id, entity_type, field_key, label, field_type, options, required, sort_order, is_template, is_deletable)
select w.id, 'deal', f.field_key, f.label, f.field_type, f.options, false, f.sort_order, true, true
from public.workspaces w
cross join (values
  ('financing_type', 'Financing Type', 'select', '["Cash","Subject To","Seller Finance","Wrap","Novation","Other"]'::jsonb, 1),
  ('loan_type',      'Loan Type',      'select', '["Conventional","FHA","VA","USDA","Private","Other"]'::jsonb, 2),
  ('loan_balance',   'Loan Balance',   'number', '[]'::jsonb, 3),
  ('interest_rate',  'Interest Rate (%)', 'number', '[]'::jsonb, 4),
  ('monthly_piti',   'Monthly PITI',   'number', '[]'::jsonb, 5),
  ('monthly_hoa',    'Monthly HOA',    'number', '[]'::jsonb, 6),
  ('cash_to_close',  'Cash to Close',  'number', '[]'::jsonb, 7)
) as f(field_key, label, field_type, options, sort_order)
where not exists (
  select 1 from public.crm_custom_fields c
  where c.workspace_id = w.id and c.entity_type = 'deal' and c.field_key = f.field_key
);
