-- Phase 1: align Ema qualification with the acquisitions workflow.
--
-- 1. Initial Ema buy-box screening should not block SFR intake on due-diligence
--    items or facts that would normally only be mentioned when exceptional.
-- 2. Asking-price/ARV ranges belong to pricing context, not Ema's screen gate.
-- 3. Portfolio document completeness is tracked separately from buy-box fit and
--    does not control CRM stage progression or Cash activation.

ALTER TABLE public.buy_box_criteria
  DROP CONSTRAINT IF EXISTS buy_box_criteria_rule_type_check;

ALTER TABLE public.buy_box_criteria
  ADD CONSTRAINT buy_box_criteria_rule_type_check
  CHECK (rule_type = ANY (ARRAY['screen'::text, 'pricing'::text, 'due_diligence'::text]));

-- Flood-zone determination is a due-diligence lookup, not an inbound-email gate.
UPDATE public.buy_box_criteria
SET rule_type = 'due_diligence'
WHERE active = true
  AND field = 'flood_zone'
  AND asset_class IN ('fix_flip', 'multifamily', 'rv_park', 'mhp');

-- These SFR facts remain useful evidence when explicitly disclosed, but their
-- absence must not turn an otherwise reviewable SFR into needs_info.
UPDATE public.buy_box_criteria
SET active = false
WHERE active = true
  AND asset_class = 'fix_flip'
  AND field IN ('fire_damage', 'structural_issues', 'post_possession');

-- Broad price/ARV ranges are financial context for Cash, not Ema qualification.
UPDATE public.buy_box_criteria
SET rule_type = 'pricing'
WHERE active = true
  AND asset_class = 'fix_flip'
  AND field IN ('purchase_price', 'arv');

ALTER TABLE public.ema_candidates
  ADD COLUMN IF NOT EXISTS portfolio_document_status text NOT NULL DEFAULT 'not_applicable',
  ADD COLUMN IF NOT EXISTS portfolio_document_inventory jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS portfolio_missing_documents jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS portfolio_document_checked_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.ema_candidates'::regclass
      AND conname = 'ema_candidates_portfolio_document_status_check'
  ) THEN
    ALTER TABLE public.ema_candidates
      ADD CONSTRAINT ema_candidates_portfolio_document_status_check
      CHECK (portfolio_document_status IN ('not_applicable', 'not_checked', 'incomplete', 'complete'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.ema_candidates'::regclass
      AND conname = 'ema_candidates_portfolio_document_inventory_check'
  ) THEN
    ALTER TABLE public.ema_candidates
      ADD CONSTRAINT ema_candidates_portfolio_document_inventory_check
      CHECK (jsonb_typeof(portfolio_document_inventory) = 'object');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.ema_candidates'::regclass
      AND conname = 'ema_candidates_portfolio_missing_documents_check'
  ) THEN
    ALTER TABLE public.ema_candidates
      ADD CONSTRAINT ema_candidates_portfolio_missing_documents_check
      CHECK (jsonb_typeof(portfolio_missing_documents) = 'array');
  END IF;
END $$;

-- Existing supported portfolio candidates should be explicitly waiting for a
-- document inventory rather than appearing not-applicable.
UPDATE public.ema_candidates
SET portfolio_document_status = 'not_checked'
WHERE portfolio_document_status = 'not_applicable'
  AND (
    lower(coalesce(extracted_facts->>'asset_class', '')) IN ('multifamily', 'rv_park', 'rv park', 'mhp', 'mobile_home_park', 'mobile home park')
    OR lower(coalesce(extracted_facts->>'property_type', '')) ~ '(multi.?family|apartment|rv park|recreational vehicle park|mobile home park|mhp)'
  );
