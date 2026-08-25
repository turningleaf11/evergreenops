-- Ema acquisition-screening policy:
-- - sqft remains visible but does not block initial intake when missing or under 1,000 sqft
-- - beds/baths remain hard when known, but runtime policy does not spend DealMachine credits to resolve them
-- - HOA remains hard when known; unknown HOA is a human-review item and does not trigger paid enrichment

update public.buy_box_criteria
set
  hardness = 'soft',
  notes = 'Informational at Ema screening. Missing or under-threshold sqft does not block initial intake or justify paid property enrichment.'
where asset_class = 'fix_flip'
  and rule_type = 'screen'
  and field = 'sqft'
  and active = true;
