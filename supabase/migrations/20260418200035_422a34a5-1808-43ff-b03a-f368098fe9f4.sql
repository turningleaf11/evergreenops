-- 1. Add color to note_folders (notebooks)
ALTER TABLE public.note_folders
  ADD COLUMN IF NOT EXISTS color text NOT NULL DEFAULT '220 65% 55%';

-- 2. Add pinned + notebook_id to notes
ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS pinned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notebook_id uuid REFERENCES public.note_folders(id) ON DELETE SET NULL;

-- 3. Backfill notebook_id from legacy text folder name
UPDATE public.notes n
SET notebook_id = nf.id
FROM public.note_folders nf
WHERE n.folder IS NOT NULL
  AND n.notebook_id IS NULL
  AND nf.user_id = n.user_id
  AND nf.name = n.folder;

-- 4. Index for fast sidebar queries
CREATE INDEX IF NOT EXISTS idx_notes_user_notebook ON public.notes(user_id, notebook_id);
CREATE INDEX IF NOT EXISTS idx_notes_user_pinned ON public.notes(user_id, pinned) WHERE pinned = true;