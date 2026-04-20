ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS cover_url TEXT, ADD COLUMN IF NOT EXISTS icon TEXT;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS cover_url TEXT, ADD COLUMN IF NOT EXISTS icon TEXT;
CREATE INDEX IF NOT EXISTS idx_documents_content_mention ON public.documents USING gin (to_tsvector('simple', coalesce(content, '')));
CREATE INDEX IF NOT EXISTS idx_notes_content_mention ON public.notes USING gin (to_tsvector('simple', coalesce(content, '')));