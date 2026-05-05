-- Harden defaults trigger: always set ownership/workspace server-side from auth.uid()
CREATE OR REPLACE FUNCTION public.ai_projects_set_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ws uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be signed in to create AI projects';
  END IF;

  -- Always force created_by to the authenticated user
  NEW.created_by := auth.uid();

  -- Resolve workspace from the user's profile
  SELECT workspace_id INTO ws FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
  IF ws IS NULL THEN
    RAISE EXCEPTION 'Your account is not assigned to a workspace';
  END IF;
  NEW.workspace_id := ws;

  IF NEW.owner_id IS NULL THEN
    NEW.owner_id := auth.uid();
  END IF;

  RETURN NEW;
END;
$$;

-- Make sure the trigger is attached
DROP TRIGGER IF EXISTS trg_ai_projects_set_defaults ON public.ai_projects;
CREATE TRIGGER trg_ai_projects_set_defaults
BEFORE INSERT ON public.ai_projects
FOR EACH ROW EXECUTE FUNCTION public.ai_projects_set_defaults();

-- Replace INSERT policy with a simple, robust check (server-side trigger sets the rest)
DROP POLICY IF EXISTS "Workspace members create ai projects" ON public.ai_projects;
CREATE POLICY "Authenticated users create ai projects"
ON public.ai_projects
FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());