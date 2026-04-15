
-- Add type and banner_color to announcements
ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS banner_color text;

-- Create post_reactions table
CREATE TABLE public.post_reactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  user_id uuid NOT NULL,
  emoji text NOT NULL DEFAULT '👍',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(entity_type, entity_id, user_id, emoji)
);

ALTER TABLE public.post_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view reactions"
  ON public.post_reactions FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can add reactions"
  ON public.post_reactions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove own reactions"
  ON public.post_reactions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Create post_replies table
CREATE TABLE public.post_replies (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  user_id uuid NOT NULL,
  author_name text,
  content text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.post_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view replies"
  ON public.post_replies FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can create replies"
  ON public.post_replies FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own replies"
  ON public.post_replies FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own replies"
  ON public.post_replies FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_post_replies_updated_at
  BEFORE UPDATE ON public.post_replies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_post_reactions_entity ON public.post_reactions(entity_type, entity_id);
CREATE INDEX idx_post_replies_entity ON public.post_replies(entity_type, entity_id);
