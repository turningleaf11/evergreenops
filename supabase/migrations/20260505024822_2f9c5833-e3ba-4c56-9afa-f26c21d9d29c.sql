-- Make AI Workshop policies evaluate the row being created/returned directly.
-- This avoids INSERT RETURNING failures caused by looking the new row up through a helper function.

CREATE OR REPLACE FUNCTION public.can_access_ai_project(_project_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.ai_projects p
    JOIN public.profiles pr ON pr.user_id = _user_id
    WHERE p.id = _project_id
      AND p.workspace_id = pr.workspace_id
      AND (
        public.has_role(_user_id, 'admin'::app_role)
        OR p.owner_id = _user_id
        OR p.created_by = _user_id
        OR public.is_ai_project_collaborator(p.id, _user_id)
        OR p.visibility = 'workspace'
        OR (p.visibility = 'departments' AND pr.department_id = ANY(p.shared_department_ids))
        OR (p.visibility = 'private' AND _user_id = ANY(p.shared_member_ids))
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.can_edit_ai_project(_project_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.ai_projects p
    JOIN public.profiles pr ON pr.user_id = _user_id
    WHERE p.id = _project_id
      AND p.workspace_id = pr.workspace_id
      AND (
        public.has_role(_user_id, 'admin'::app_role)
        OR p.owner_id = _user_id
        OR p.created_by = _user_id
        OR public.is_ai_project_collaborator(p.id, _user_id)
      )
  )
$$;

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

  SELECT workspace_id
    INTO ws
    FROM public.profiles
   WHERE user_id = auth.uid()
   LIMIT 1;

  IF ws IS NULL THEN
    RAISE EXCEPTION 'Your account is not assigned to a workspace';
  END IF;

  NEW.created_by := auth.uid();
  NEW.workspace_id := ws;
  NEW.owner_id := COALESCE(NEW.owner_id, auth.uid());
  NEW.visibility := COALESCE(NEW.visibility, 'workspace');
  NEW.stage := COALESCE(NEW.stage, 'idea');
  NEW.platforms := COALESCE(NEW.platforms, '{}'::text[]);
  NEW.tags := COALESCE(NEW.tags, '{}'::text[]);
  NEW.shared_department_ids := COALESCE(NEW.shared_department_ids, '{}'::text[]);
  NEW.shared_member_ids := COALESCE(NEW.shared_member_ids, '{}'::uuid[]);

  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS "Authenticated users create ai projects" ON public.ai_projects;
DROP POLICY IF EXISTS "Workspace members create ai projects" ON public.ai_projects;
DROP POLICY IF EXISTS "Users can create ai projects" ON public.ai_projects;
DROP POLICY IF EXISTS "View accessible ai projects" ON public.ai_projects;
DROP POLICY IF EXISTS "Editors update ai projects" ON public.ai_projects;
DROP POLICY IF EXISTS "Editors delete ai projects" ON public.ai_projects;

CREATE POLICY "Workspace members create ai projects"
ON public.ai_projects
FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND workspace_id = public.get_user_workspace_id()
);

CREATE POLICY "View accessible ai projects"
ON public.ai_projects
FOR SELECT
TO authenticated
USING (
  workspace_id = public.get_user_workspace_id()
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR owner_id = auth.uid()
    OR created_by = auth.uid()
    OR public.is_ai_project_collaborator(id, auth.uid())
    OR visibility = 'workspace'
    OR (
      visibility = 'departments'
      AND EXISTS (
        SELECT 1
        FROM public.profiles pr
        WHERE pr.user_id = auth.uid()
          AND pr.workspace_id = ai_projects.workspace_id
          AND pr.department_id = ANY(ai_projects.shared_department_ids)
      )
    )
    OR (
      visibility = 'private'
      AND auth.uid() = ANY(shared_member_ids)
    )
  )
);

CREATE POLICY "Editors update ai projects"
ON public.ai_projects
FOR UPDATE
TO authenticated
USING (
  workspace_id = public.get_user_workspace_id()
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR owner_id = auth.uid()
    OR created_by = auth.uid()
    OR public.is_ai_project_collaborator(id, auth.uid())
  )
)
WITH CHECK (
  workspace_id = public.get_user_workspace_id()
  AND created_by IS NOT NULL
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR owner_id = auth.uid()
    OR created_by = auth.uid()
    OR public.is_ai_project_collaborator(id, auth.uid())
  )
);

CREATE POLICY "Editors delete ai projects"
ON public.ai_projects
FOR DELETE
TO authenticated
USING (
  workspace_id = public.get_user_workspace_id()
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR owner_id = auth.uid()
    OR created_by = auth.uid()
    OR public.is_ai_project_collaborator(id, auth.uid())
  )
);