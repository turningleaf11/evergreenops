ALTER TABLE public.comments
  ADD COLUMN IF NOT EXISTS gif_url text,
  ADD COLUMN IF NOT EXISTS audio_url text,
  ADD COLUMN IF NOT EXISTS content_html text;