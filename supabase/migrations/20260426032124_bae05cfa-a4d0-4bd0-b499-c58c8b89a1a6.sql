
-- Extend deals with portfolio underwriting fields
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS lane text NOT NULL DEFAULT 'portfolio',
  ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS property_address text,
  ADD COLUMN IF NOT EXISTS property_city text,
  ADD COLUMN IF NOT EXISTS property_state text,
  ADD COLUMN IF NOT EXISTS property_zip text,
  ADD COLUMN IF NOT EXISTS property_type text,
  ADD COLUMN IF NOT EXISTS units integer,
  ADD COLUMN IF NOT EXISTS sqft integer,
  ADD COLUMN IF NOT EXISTS asking_price numeric,
  ADD COLUMN IF NOT EXISTS seller_stated_value numeric,
  ADD COLUMN IF NOT EXISTS source_contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS stage_entered_at timestamptz,
  ADD COLUMN IF NOT EXISTS quick_arv numeric,
  ADD COLUMN IF NOT EXISTS repair_estimate numeric,
  ADD COLUMN IF NOT EXISTS mao numeric,
  ADD COLUMN IF NOT EXISTS spread numeric,
  ADD COLUMN IF NOT EXISTS listed_cap_rate numeric,
  ADD COLUMN IF NOT EXISTS our_cap_rate numeric,
  ADD COLUMN IF NOT EXISTS gross_income numeric,
  ADD COLUMN IF NOT EXISTS vacancy_rate numeric,
  ADD COLUMN IF NOT EXISTS effective_gross_income numeric,
  ADD COLUMN IF NOT EXISTS operating_expenses numeric,
  ADD COLUMN IF NOT EXISTS noi numeric,
  ADD COLUMN IF NOT EXISTS our_value numeric,
  ADD COLUMN IF NOT EXISTS price_per_unit numeric,
  ADD COLUMN IF NOT EXISTS price_per_sqft numeric,
  ADD COLUMN IF NOT EXISTS broker_feedback text,
  ADD COLUMN IF NOT EXISTS loi_date date,
  ADD COLUMN IF NOT EXISTS loi_amount numeric,
  ADD COLUMN IF NOT EXISTS disposition_strategy text;

ALTER TABLE public.deals
  DROP CONSTRAINT IF EXISTS deals_disposition_strategy_check;
ALTER TABLE public.deals
  ADD CONSTRAINT deals_disposition_strategy_check
  CHECK (disposition_strategy IS NULL OR disposition_strategy IN ('buy_hold','assign','double_close','pass'));

-- Backfill stage_entered_at for existing deals
UPDATE public.deals SET stage_entered_at = COALESCE(stage_entered_at, updated_at, created_at) WHERE stage_entered_at IS NULL;

-- Trigger to track stage_entered_at on stage change
CREATE OR REPLACE FUNCTION public.deals_track_stage_entered()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.stage_entered_at := COALESCE(NEW.stage_entered_at, now());
  ELSIF TG_OP = 'UPDATE' AND NEW.stage_id IS DISTINCT FROM OLD.stage_id THEN
    NEW.stage_entered_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS deals_track_stage_entered_trg ON public.deals;
CREATE TRIGGER deals_track_stage_entered_trg
BEFORE INSERT OR UPDATE ON public.deals
FOR EACH ROW EXECUTE FUNCTION public.deals_track_stage_entered();

-- Rename existing 6 stages in-place, then add 3 more so we get the 9-stage portfolio sequence
DO $$
DECLARE
  pl_id uuid;
  stage_ids uuid[];
BEGIN
  SELECT id INTO pl_id FROM public.pipelines ORDER BY created_at ASC LIMIT 1;
  IF pl_id IS NULL THEN RETURN; END IF;

  SELECT array_agg(id ORDER BY sort_order) INTO stage_ids
  FROM public.pipeline_stages WHERE pipeline_id = pl_id;

  -- Rename existing 6 stages preserving IDs
  IF array_length(stage_ids,1) >= 1 THEN
    UPDATE public.pipeline_stages SET name='Buy Box Check', sort_order=0, is_won=false, is_lost=false WHERE id = stage_ids[1];
  END IF;
  IF array_length(stage_ids,1) >= 2 THEN
    UPDATE public.pipeline_stages SET name='Quick Underwrite', sort_order=1, is_won=false, is_lost=false WHERE id = stage_ids[2];
  END IF;
  IF array_length(stage_ids,1) >= 3 THEN
    UPDATE public.pipeline_stages SET name='Broker Feedback', sort_order=2, is_won=false, is_lost=false WHERE id = stage_ids[3];
  END IF;
  IF array_length(stage_ids,1) >= 4 THEN
    UPDATE public.pipeline_stages SET name='Under Contract', sort_order=6, is_won=false, is_lost=false WHERE id = stage_ids[4];
  END IF;
  IF array_length(stage_ids,1) >= 5 THEN
    UPDATE public.pipeline_stages SET name='Closed', sort_order=7, is_won=true, is_lost=false WHERE id = stage_ids[5];
  END IF;
  IF array_length(stage_ids,1) >= 6 THEN
    UPDATE public.pipeline_stages SET name='Dead', sort_order=8, is_won=false, is_lost=true WHERE id = stage_ids[6];
  END IF;

  -- Add the 3 missing middle stages if not present by name
  IF NOT EXISTS (SELECT 1 FROM public.pipeline_stages WHERE pipeline_id=pl_id AND name='Deep Underwrite') THEN
    INSERT INTO public.pipeline_stages (pipeline_id, name, sort_order, color, is_won, is_lost)
    VALUES (pl_id, 'Deep Underwrite', 3, '210 70% 50%', false, false);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.pipeline_stages WHERE pipeline_id=pl_id AND name='LOI Sent') THEN
    INSERT INTO public.pipeline_stages (pipeline_id, name, sort_order, color, is_won, is_lost)
    VALUES (pl_id, 'LOI Sent', 4, '270 60% 55%', false, false);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.pipeline_stages WHERE pipeline_id=pl_id AND name='Due Diligence') THEN
    INSERT INTO public.pipeline_stages (pipeline_id, name, sort_order, color, is_won, is_lost)
    VALUES (pl_id, 'Due Diligence', 5, '35 90% 55%', false, false);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_deals_lead_id ON public.deals(lead_id);
CREATE INDEX IF NOT EXISTS idx_deals_source_contact_id ON public.deals(source_contact_id);
