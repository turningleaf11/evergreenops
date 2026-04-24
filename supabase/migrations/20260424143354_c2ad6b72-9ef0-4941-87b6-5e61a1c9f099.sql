CREATE TABLE public.database_forms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  database_id UUID NOT NULL,
  workspace_id UUID NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL DEFAULT 'Untitled form',
  description TEXT NOT NULL DEFAULT '',
  visibility TEXT NOT NULL DEFAULT 'internal' CHECK (visibility IN ('public', 'internal')),
  fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  submit_message TEXT NOT NULL DEFAULT 'Thanks! Your submission was received.',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_database_forms_slug ON public.database_forms(slug);
CREATE INDEX idx_database_forms_database ON public.database_forms(database_id);

ALTER TABLE public.database_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage forms in their workspace"
ON public.database_forms
FOR ALL
TO authenticated
USING (workspace_id = public.get_user_workspace_id() AND public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (workspace_id = public.get_user_workspace_id() AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Workspace members view active forms"
ON public.database_forms
FOR SELECT
TO authenticated
USING (workspace_id = public.get_user_workspace_id() AND is_active = true);

CREATE TRIGGER update_database_forms_updated_at
BEFORE UPDATE ON public.database_forms
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();