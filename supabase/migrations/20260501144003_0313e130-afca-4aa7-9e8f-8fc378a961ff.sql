ALTER TABLE public.leads DROP COLUMN IF EXISTS sqft;
ALTER TABLE public.deals DROP COLUMN IF EXISTS sqft;
ALTER TABLE public.deals DROP COLUMN IF EXISTS price_per_sqft;
ALTER TABLE public.crm_transactions DROP COLUMN IF EXISTS sqft;