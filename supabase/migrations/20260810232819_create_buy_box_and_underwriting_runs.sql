-- Buy box: the pre-underwriting intake filter Cash (and later Hunter) screens against.
-- Deliberately separate from the financial thresholds that live in the underwriting tools —
-- the buy box decides "do we look at this", the metrics decide "is it a deal".

CREATE TABLE IF NOT EXISTS public.buy_box_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID,
  asset_class TEXT NOT NULL,            -- fix_flip | multifamily | rv_park | mhp | business
  field TEXT NOT NULL,                  -- beds | sqft | units | purchase_price | geography | ...
  operator TEXT NOT NULL,               -- min | max | range | in | not_in | boolean
  value JSONB NOT NULL,                 -- {"min":3} | {"min":150000,"max":750000} | ["Miami-Dade",...]
  hardness TEXT NOT NULL DEFAULT 'hard' CHECK (hardness IN ('hard','soft')),
  label TEXT NOT NULL,                  -- human-readable, e.g. "3 bed, 2 bath +"
  active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS buy_box_criteria_class_idx ON public.buy_box_criteria(asset_class, active);

-- Exceptions are the institutional knowledge. Two shapes:
--   widened_band          -> relax a threshold, no modeling change
--   conditional_adjustment-> rule is curable; apply a cost/model change, then re-run
CREATE TABLE IF NOT EXISTS public.buy_box_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID,
  asset_class TEXT NOT NULL,
  triggers_on TEXT,                     -- which criterion field this relaxes (null = global)
  exception_type TEXT NOT NULL CHECK (exception_type IN ('widened_band','conditional_adjustment')),
  condition TEXT NOT NULL,              -- what must be true to apply it
  adjustment TEXT,                      -- the cost/model change (conditional_adjustment only)
  requires_human BOOLEAN NOT NULL DEFAULT true,
  label TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS buy_box_exceptions_class_idx ON public.buy_box_exceptions(asset_class, active);

-- The cross-app index: which tool underwrote which deal, where it lives, what it said.
-- Does NOT duplicate inputs or math — those stay authoritative in the app.
-- The actual_* columns are the calibration substrate (predicted vs. actual).
CREATE TABLE IF NOT EXISTS public.underwriting_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID,
  deal_id UUID,                         -- OpsHQ deal, when there is one
  ghl_opportunity_id TEXT,              -- GHL is the operational system of record
  property_address TEXT,
  asset_class TEXT,
  tool TEXT NOT NULL CHECK (tool IN ('arva','napkin','bda','rv_sheet','manual')),
  external_record_id TEXT,              -- the deal/property id inside that tool
  external_url TEXT,                    -- deep link back to it
  tier TEXT NOT NULL DEFAULT 'full' CHECK (tier IN ('screen','full')),
  verdict TEXT CHECK (verdict IN ('pass','fail','marginal','needs_info')),
  buy_box_result JSONB,                 -- which criteria passed/failed, exceptions applied
  headline_metrics JSONB,               -- MAO, DSCR, CoC, IRR, profit — whatever that tool reports
  limiting_factor TEXT,                 -- from Napkin's solver when applicable
  run_by TEXT,                          -- 'cash' | a user id
  packet_url TEXT,
  -- calibration (filled in after close)
  actual_repair_cost NUMERIC,
  actual_sale_price NUMERIC,
  actual_insurance NUMERIC,
  actual_rents NUMERIC,
  actual_days_to_close INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS underwriting_runs_deal_idx ON public.underwriting_runs(deal_id);
CREATE INDEX IF NOT EXISTS underwriting_runs_ghl_idx ON public.underwriting_runs(ghl_opportunity_id);
CREATE INDEX IF NOT EXISTS underwriting_runs_created_idx ON public.underwriting_runs(created_at DESC);

ALTER TABLE public.buy_box_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buy_box_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.underwriting_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "buy_box_criteria_auth" ON public.buy_box_criteria;
CREATE POLICY "buy_box_criteria_auth" ON public.buy_box_criteria FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "buy_box_exceptions_auth" ON public.buy_box_exceptions;
CREATE POLICY "buy_box_exceptions_auth" ON public.buy_box_exceptions FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "underwriting_runs_auth" ON public.underwriting_runs;
CREATE POLICY "underwriting_runs_auth" ON public.underwriting_runs FOR ALL TO authenticated USING (true) WITH CHECK (true);;
