-- Cached AI-generated daily briefings for the CEO Today tab.

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.daily_briefings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  briefing_date DATE NOT NULL,
  bullets JSONB NOT NULL DEFAULT '[]'::jsonb,
  focus TEXT NOT NULL DEFAULT '',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT daily_briefings_user_date_key UNIQUE (user_id, briefing_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_briefings_user_date
  ON public.daily_briefings(user_id, briefing_date DESC);

ALTER TABLE public.daily_briefings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "daily_briefings owner select" ON public.daily_briefings;
CREATE POLICY "daily_briefings owner select"
  ON public.daily_briefings FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "daily_briefings owner insert" ON public.daily_briefings;
CREATE POLICY "daily_briefings owner insert"
  ON public.daily_briefings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "daily_briefings owner update" ON public.daily_briefings;
CREATE POLICY "daily_briefings owner update"
  ON public.daily_briefings FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "daily_briefings owner delete" ON public.daily_briefings;
CREATE POLICY "daily_briefings owner delete"
  ON public.daily_briefings FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'set_daily_briefings_updated_at'
  ) THEN
    CREATE TRIGGER set_daily_briefings_updated_at
      BEFORE UPDATE ON public.daily_briefings
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
