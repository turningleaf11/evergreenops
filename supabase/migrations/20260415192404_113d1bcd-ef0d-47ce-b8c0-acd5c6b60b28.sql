-- Add gif_url and audio_url to post_replies
ALTER TABLE public.post_replies ADD COLUMN gif_url text;
ALTER TABLE public.post_replies ADD COLUMN audio_url text;

-- Create user_favorites table
CREATE TABLE public.user_favorites (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  label text NOT NULL DEFAULT '',
  url text NOT NULL DEFAULT '',
  icon text NOT NULL DEFAULT 'Link',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.user_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own favorites"
ON public.user_favorites FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own favorites"
ON public.user_favorites FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own favorites"
ON public.user_favorites FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own favorites"
ON public.user_favorites FOR DELETE
USING (auth.uid() = user_id);