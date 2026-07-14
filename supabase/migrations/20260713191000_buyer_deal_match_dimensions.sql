-- County/Metro becomes its own matching dimension (separate from cities),
-- and deals gain the fields the buyer match needs (flow from GHL at intake,
-- or entered manually meanwhile).
alter table public.dispo_buyers    add column if not exists county_metro text[] default '{}';
alter table public.crm_transactions add column if not exists property_county_metro text;
alter table public.crm_transactions add column if not exists best_exit text;
