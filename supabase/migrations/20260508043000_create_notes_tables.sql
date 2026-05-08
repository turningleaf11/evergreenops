-- Notes workspace tables used by /notes and /n/:token.

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.note_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '220 65% 55%',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled Note',
  content TEXT NOT NULL DEFAULT '',
  folder TEXT,
  notebook_id UUID REFERENCES public.note_folders(id) ON DELETE SET NULL,
  pinned BOOLEAN NOT NULL DEFAULT false,
  converted_doc_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  is_public BOOLEAN NOT NULL DEFAULT false,
  share_token TEXT UNIQUE,
  shared_with JSONB NOT NULL DEFAULT '{"memberIds": []}'::jsonb,
  cover_url TEXT,
  icon TEXT,
  cover_position INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_note_folders_user_sort
  ON public.note_folders(user_id, sort_order, name);

CREATE INDEX IF NOT EXISTS idx_notes_user_updated
  ON public.notes(user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_notes_notebook_id
  ON public.notes(notebook_id);

CREATE INDEX IF NOT EXISTS idx_notes_share_token_public
  ON public.notes(share_token)
  WHERE is_public = true AND share_token IS NOT NULL;

ALTER TABLE public.note_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "note_folders owner select" ON public.note_folders;
CREATE POLICY "note_folders owner select"
  ON public.note_folders FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "note_folders owner insert" ON public.note_folders;
CREATE POLICY "note_folders owner insert"
  ON public.note_folders FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "note_folders owner update" ON public.note_folders;
CREATE POLICY "note_folders owner update"
  ON public.note_folders FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "note_folders owner delete" ON public.note_folders;
CREATE POLICY "note_folders owner delete"
  ON public.note_folders FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notes owner select" ON public.notes;
CREATE POLICY "notes owner select"
  ON public.notes FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notes shared select" ON public.notes;
CREATE POLICY "notes shared select"
  ON public.notes FOR SELECT TO authenticated
  USING (shared_with->'memberIds' ? auth.uid()::text);

DROP POLICY IF EXISTS "notes public select" ON public.notes;
CREATE POLICY "notes public select"
  ON public.notes FOR SELECT TO anon, authenticated
  USING (is_public = true AND share_token IS NOT NULL);

DROP POLICY IF EXISTS "notes owner insert" ON public.notes;
CREATE POLICY "notes owner insert"
  ON public.notes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "notes owner update" ON public.notes;
CREATE POLICY "notes owner update"
  ON public.notes FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "notes owner delete" ON public.notes;
CREATE POLICY "notes owner delete"
  ON public.notes FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'set_note_folders_updated_at'
  ) THEN
    CREATE TRIGGER set_note_folders_updated_at
      BEFORE UPDATE ON public.note_folders
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'set_notes_updated_at'
  ) THEN
    CREATE TRIGGER set_notes_updated_at
      BEFORE UPDATE ON public.notes
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
