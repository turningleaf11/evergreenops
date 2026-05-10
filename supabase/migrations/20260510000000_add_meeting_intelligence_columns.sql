-- Meeting intelligence fields migrated from ClawBuddy.
ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS ai_insights text,
  ADD COLUMN IF NOT EXISTS key_decisions text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS action_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS sentiment text,
  ADD COLUMN IF NOT EXISTS fathom_url text,
  ADD COLUMN IF NOT EXISTS recording_id text,
  ADD COLUMN IF NOT EXISTS has_external_participants boolean NOT NULL DEFAULT false;

UPDATE public.meetings
SET
  ai_insights = COALESCE(ai_insights, summary),
  fathom_url = COALESCE(fathom_url, recording_url),
  recording_id = COALESCE(recording_id, fathom_meeting_id)
WHERE
  ai_insights IS NULL
  OR fathom_url IS NULL
  OR recording_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_meetings_recording_id ON public.meetings(recording_id);
CREATE INDEX IF NOT EXISTS idx_meetings_sentiment ON public.meetings(sentiment);
