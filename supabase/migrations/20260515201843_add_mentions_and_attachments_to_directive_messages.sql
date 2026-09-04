
ALTER TABLE public.directive_messages
  ADD COLUMN IF NOT EXISTS mentions JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb;
;
