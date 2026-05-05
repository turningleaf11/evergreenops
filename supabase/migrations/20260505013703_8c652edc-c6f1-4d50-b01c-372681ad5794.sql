
CREATE OR REPLACE FUNCTION public.ai_projects_set_defaults()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.created_by IS NULL THEN NEW.created_by := auth.uid(); END IF;
  IF NEW.workspace_id IS NULL THEN NEW.workspace_id := public.get_user_workspace_id(); END IF;
  IF NEW.owner_id IS NULL THEN NEW.owner_id := NEW.created_by; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ai_projects_set_defaults ON public.ai_projects;
CREATE TRIGGER trg_ai_projects_set_defaults
BEFORE INSERT ON public.ai_projects
FOR EACH ROW EXECUTE FUNCTION public.ai_projects_set_defaults();

DROP POLICY IF EXISTS "Workspace members create ai projects" ON public.ai_projects;
CREATE POLICY "Workspace members create ai projects" ON public.ai_projects FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid());
