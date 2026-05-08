-- User-entered top priorities for the CEO Today tab.

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.daily_priorities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  priority_date DATE NOT NULL,
  slot INTEGER NOT NULL CHECK (slot BETWEEN 1 AND 3),
  text TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT daily_priorities_user_date_slot_key UNIQUE (user_id, priority_date, slot)
);

CREATE INDEX IF NOT EXISTS idx_daily_priorities_user_date
  ON public.daily_priorities(user_id, priority_date, slot);

ALTER TABLE public.daily_priorities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "daily_priorities owner select" ON public.daily_priorities;
CREATE POLICY "daily_priorities owner select"
  ON public.daily_priorities FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "daily_priorities owner insert" ON public.daily_priorities;
CREATE POLICY "daily_priorities owner insert"
  ON public.daily_priorities FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "daily_priorities owner update" ON public.daily_priorities;
CREATE POLICY "daily_priorities owner update"
  ON public.daily_priorities FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "daily_priorities owner delete" ON public.daily_priorities;
CREATE POLICY "daily_priorities owner delete"
  ON public.daily_priorities FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'set_daily_priorities_updated_at'
  ) THEN
    CREATE TRIGGER set_daily_priorities_updated_at
      BEFORE UPDATE ON public.daily_priorities
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
