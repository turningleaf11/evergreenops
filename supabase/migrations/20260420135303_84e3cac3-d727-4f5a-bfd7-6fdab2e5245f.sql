ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS cover_position numeric DEFAULT 50;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS cover_position numeric DEFAULT 50;