CREATE TABLE IF NOT EXISTS public.comments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  author_id uuid NOT NULL,
  content text NOT NULL DEFAULT '',
  content_html text,
  parent_id uuid REFERENCES public.comments(id) ON DELETE CASCADE,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  mentions jsonb NOT NULL DEFAULT '[]'::jsonb,
  gif_url text,
  audio_url text,
  agent_name text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_comments_entity ON public.comments(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON public.comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_comments_agent ON public.comments(agent_name) WHERE agent_name IS NOT NULL;

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "comments_select" ON public.comments;
CREATE POLICY "comments_select" ON public.comments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "comments_insert" ON public.comments;
CREATE POLICY "comments_insert" ON public.comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
DROP POLICY IF EXISTS "comments_update" ON public.comments;
CREATE POLICY "comments_update" ON public.comments FOR UPDATE TO authenticated USING (auth.uid() = author_id);
DROP POLICY IF EXISTS "comments_delete" ON public.comments;
CREATE POLICY "comments_delete" ON public.comments FOR DELETE TO authenticated USING (auth.uid() = author_id);
DROP POLICY IF EXISTS "comments_admin" ON public.comments;
CREATE POLICY "comments_admin" ON public.comments FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS update_comments_updated_at ON public.comments;
CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON public.comments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.entity_activity (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  actor_id uuid,
  action text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_entity_activity_entity ON public.entity_activity(entity_type, entity_id);
ALTER TABLE public.entity_activity ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "entity_activity_select" ON public.entity_activity;
CREATE POLICY "entity_activity_select" ON public.entity_activity FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "entity_activity_insert" ON public.entity_activity;
CREATE POLICY "entity_activity_insert" ON public.entity_activity FOR INSERT TO authenticated WITH CHECK (true);;
