CREATE TABLE public.idea_vault (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID,
  title TEXT NOT NULL,
  description TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'captured',
  ai_cluster TEXT,
  ai_summary TEXT,
  effort_estimate TEXT,
  time_horizon TEXT,
  promoted_to_type TEXT,
  promoted_to_id UUID,
  promoted_at TIMESTAMP WITH TIME ZONE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.idea_vault ENABLE ROW LEVEL SECURITY;

-- Helper: is the calling user the primary admin?
CREATE OR REPLACE FUNCTION public.is_primary_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'admin'
      AND is_primary = true
  )
$$;

CREATE POLICY "Primary admin can manage idea vault"
ON public.idea_vault
FOR ALL
TO authenticated
USING (public.is_primary_admin(auth.uid()))
WITH CHECK (public.is_primary_admin(auth.uid()));

CREATE TRIGGER update_idea_vault_updated_at
BEFORE UPDATE ON public.idea_vault
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_idea_vault_status ON public.idea_vault(status);
CREATE INDEX idx_idea_vault_workspace ON public.idea_vault(workspace_id);