ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS unit_mix text;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS unit_mix text;
ALTER TABLE public.crm_transactions ADD COLUMN IF NOT EXISTS unit_mix text;
ALTER TABLE public.crm_transactions ADD COLUMN IF NOT EXISTS asking_price numeric;
ALTER TABLE public.crm_transactions ADD COLUMN IF NOT EXISTS sqft integer;
ALTER TABLE public.crm_transactions ADD COLUMN IF NOT EXISTS property_zip text;