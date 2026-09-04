ALTER TABLE public.sync_threads ADD COLUMN IF NOT EXISTS linked_items JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.sync_threads ADD COLUMN IF NOT EXISTS converted_project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;;
