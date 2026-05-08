-- The feed repair migration adds columns to announcements, so make sure the table exists first.

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name TEXT,
  type TEXT NOT NULL DEFAULT 'general',
  pinned BOOLEAN DEFAULT false,
  banner_color TEXT,
  department_id UUID,
  workspace_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON public.announcements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_pinned ON public.announcements(pinned) WHERE pinned = true;

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "announcements authenticated all" ON public.announcements;
CREATE POLICY "announcements authenticated all"
  ON public.announcements FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'set_announcements_updated_at'
  ) THEN
    CREATE TRIGGER set_announcements_updated_at
      BEFORE UPDATE ON public.announcements
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
