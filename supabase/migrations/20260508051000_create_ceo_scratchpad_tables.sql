-- CEO Cockpit scratchpad persistence, history, and AI triage queue.

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.ceo_scratch_pad (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ceo_scratch_pad_user_id_key UNIQUE (user_id)
);

ALTER TABLE public.ceo_scratch_pad ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.ceo_scratch_pad ADD COLUMN IF NOT EXISTS content TEXT NOT NULL DEFAULT '';
ALTER TABLE public.ceo_scratch_pad ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.ceo_scratch_pad ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS idx_ceo_scratch_pad_user_id ON public.ceo_scratch_pad(user_id);

CREATE TABLE IF NOT EXISTS public.ceo_scratch_pad_archive (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  triaged_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ceo_scratch_pad_archive ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.ceo_scratch_pad_archive ADD COLUMN IF NOT EXISTS content TEXT NOT NULL DEFAULT '';
ALTER TABLE public.ceo_scratch_pad_archive ADD COLUMN IF NOT EXISTS triaged_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.ceo_scratch_pad_archive ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_ceo_scratch_pad_archive_user_created ON public.ceo_scratch_pad_archive(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.ceo_triage_pending (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'task',
  suggested_assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  suggested_priority TEXT NOT NULL DEFAULT 'medium',
  reasoning TEXT NOT NULL DEFAULT '',
  source_archive_id UUID REFERENCES public.ceo_scratch_pad_archive(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ceo_triage_pending_category_check CHECK (category IN ('task', 'project', 'decision', 'idea', 'delegation')),
  CONSTRAINT ceo_triage_pending_priority_check CHECK (suggested_priority IN ('low', 'medium', 'high'))
);

ALTER TABLE public.ceo_triage_pending ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.ceo_triage_pending ADD COLUMN IF NOT EXISTS text TEXT NOT NULL DEFAULT '';
ALTER TABLE public.ceo_triage_pending ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'task';
ALTER TABLE public.ceo_triage_pending ADD COLUMN IF NOT EXISTS suggested_assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.ceo_triage_pending ADD COLUMN IF NOT EXISTS suggested_priority TEXT NOT NULL DEFAULT 'medium';
ALTER TABLE public.ceo_triage_pending ADD COLUMN IF NOT EXISTS reasoning TEXT NOT NULL DEFAULT '';
ALTER TABLE public.ceo_triage_pending ADD COLUMN IF NOT EXISTS source_archive_id UUID REFERENCES public.ceo_scratch_pad_archive(id) ON DELETE SET NULL;
ALTER TABLE public.ceo_triage_pending ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.ceo_triage_pending ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_ceo_triage_pending_user_created ON public.ceo_triage_pending(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ceo_triage_pending_source_archive ON public.ceo_triage_pending(source_archive_id);

ALTER TABLE public.ceo_scratch_pad ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ceo_scratch_pad_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ceo_triage_pending ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ceo_scratch_pad owner all" ON public.ceo_scratch_pad;
CREATE POLICY "ceo_scratch_pad owner all" ON public.ceo_scratch_pad
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "ceo_scratch_pad_archive owner all" ON public.ceo_scratch_pad_archive;
CREATE POLICY "ceo_scratch_pad_archive owner all" ON public.ceo_scratch_pad_archive
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "ceo_triage_pending owner all" ON public.ceo_triage_pending;
CREATE POLICY "ceo_triage_pending owner all" ON public.ceo_triage_pending
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_ceo_scratch_pad_updated_at') THEN
    CREATE TRIGGER set_ceo_scratch_pad_updated_at
      BEFORE UPDATE ON public.ceo_scratch_pad
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_ceo_triage_pending_updated_at') THEN
    CREATE TRIGGER set_ceo_triage_pending_updated_at
      BEFORE UPDATE ON public.ceo_triage_pending
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
