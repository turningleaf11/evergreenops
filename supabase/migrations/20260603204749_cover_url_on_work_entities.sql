-- cover_url for entities that can show a hero image on their card
-- (property photo on deals, marketing screenshot on tasks, etc.)
-- Same column name as documents.cover_url for consistency.

ALTER TABLE public.deals    ADD COLUMN IF NOT EXISTS cover_url text;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS cover_url text;
ALTER TABLE public.tasks    ADD COLUMN IF NOT EXISTS cover_url text;
ALTER TABLE public.leads    ADD COLUMN IF NOT EXISTS cover_url text;;
