-- Bring the leads table in line with the TypeScript types + lead form.
-- These columns were always expected (lead form has had asking_price, units,
-- property_address etc. since launch) but the original migration only created
-- the contact basics. This adds the property + underwriting fields.

ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS property_address  text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS property_city     text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS property_state    text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS property_zip      text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS property_type     text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS units             integer;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS unit_mix          text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS beds              numeric;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS baths             numeric;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS sqft              integer;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS lot_size          text;

-- Pricing + underwriting
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS asking_price      numeric;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS gross_income      numeric;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS noi               numeric;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS listed_cap_rate   numeric;

-- Document availability flags (helps Acquisitions know what they have on hand)
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS has_om            boolean NOT NULL DEFAULT false;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS has_t12           boolean NOT NULL DEFAULT false;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS has_rent_roll     boolean NOT NULL DEFAULT false;

-- Qualification / lane / source
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS lane              text NOT NULL DEFAULT 'wholesale';
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS buy_box_fit       text NOT NULL DEFAULT 'unknown';
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS disqualification_reason text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS source_contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_leads_lane            ON public.leads(lane);
CREATE INDEX IF NOT EXISTS idx_leads_property_state  ON public.leads(property_state);;
