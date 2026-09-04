-- Pin support for crm_activities. The Activity tab queries this column and
-- the entire fetch fails silently when it doesn't exist — meaning notes save
-- successfully but nothing renders. Adding the column unblocks the whole
-- activity timeline.

ALTER TABLE public.crm_activities
  ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT false;

-- Helpful index for "pinned first" sort
CREATE INDEX IF NOT EXISTS idx_crm_activities_pinned
  ON public.crm_activities(entity_type, entity_id, is_pinned DESC, occurred_at DESC);;
