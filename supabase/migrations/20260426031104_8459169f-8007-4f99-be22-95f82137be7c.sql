ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS lane text NOT NULL DEFAULT 'portfolio',
  ADD COLUMN IF NOT EXISTS property_address text,
  ADD COLUMN IF NOT EXISTS property_city text,
  ADD COLUMN IF NOT EXISTS property_state text,
  ADD COLUMN IF NOT EXISTS property_zip text,
  ADD COLUMN IF NOT EXISTS property_type text,
  ADD COLUMN IF NOT EXISTS units integer,
  ADD COLUMN IF NOT EXISTS beds integer,
  ADD COLUMN IF NOT EXISTS baths numeric,
  ADD COLUMN IF NOT EXISTS sqft integer,
  ADD COLUMN IF NOT EXISTS lot_size text,
  ADD COLUMN IF NOT EXISTS asking_price numeric,
  ADD COLUMN IF NOT EXISTS listed_cap_rate numeric,
  ADD COLUMN IF NOT EXISTS gross_income numeric,
  ADD COLUMN IF NOT EXISTS noi numeric,
  ADD COLUMN IF NOT EXISTS source_contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS buy_box_fit text NOT NULL DEFAULT 'unchecked',
  ADD COLUMN IF NOT EXISTS disqualification_reason text,
  ADD COLUMN IF NOT EXISTS has_om boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_t12 boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_rent_roll boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leads_buy_box_fit_check') THEN
    ALTER TABLE public.leads
      ADD CONSTRAINT leads_buy_box_fit_check
      CHECK (buy_box_fit IN ('yes','maybe','no','unchecked'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leads_property_type_check') THEN
    ALTER TABLE public.leads
      ADD CONSTRAINT leads_property_type_check
      CHECK (property_type IS NULL OR property_type IN (
        'SFR','SFR Portfolio','MF Small (2-4)','MF Large (5+)',
        'Mixed Use','Commercial','Land','Other'
      ));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_leads_lane ON public.leads(lane);
CREATE INDEX IF NOT EXISTS idx_leads_buy_box_fit ON public.leads(buy_box_fit);
CREATE INDEX IF NOT EXISTS idx_leads_source_contact ON public.leads(source_contact_id);