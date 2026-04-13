
-- Add new columns to projects
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS assignees uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS notes_content text NOT NULL DEFAULT '';

-- Add new columns to tasks
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS subtasks jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS notes_content text NOT NULL DEFAULT '';

-- Create comments table
CREATE TABLE public.comments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  author_id uuid NOT NULL,
  content text NOT NULL DEFAULT '',
  parent_id uuid REFERENCES public.comments(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_comments_entity ON public.comments(entity_type, entity_id);
CREATE INDEX idx_comments_parent ON public.comments(parent_id);

CREATE POLICY "Authenticated users can view comments"
  ON public.comments FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create comments"
  ON public.comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Authors can update their comments"
  ON public.comments FOR UPDATE TO authenticated
  USING (auth.uid() = author_id);

CREATE POLICY "Authors can delete their comments"
  ON public.comments FOR DELETE TO authenticated
  USING (auth.uid() = author_id);

CREATE POLICY "Admins can manage all comments"
  ON public.comments FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_comments_updated_at
  BEFORE UPDATE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create entity_activity table
CREATE TABLE public.entity_activity (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  actor_id uuid,
  action text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.entity_activity ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_entity_activity_entity ON public.entity_activity(entity_type, entity_id);

CREATE POLICY "Authenticated users can view activity"
  ON public.entity_activity FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create activity"
  ON public.entity_activity FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can manage all activity"
  ON public.entity_activity FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
