-- County/Metro becomes its own matching dimension (separate from cities).
alter table public.dispo_buyers   add column if not exists county_metro text[] default '{}';
-- Deal-side fields the buyer match needs (flow from GHL at intake, or manual).
alter table public.crm_transactions add column if not exists property_county_metro text;
alter table public.crm_transactions add column if not exists best_exit text;;
