
-- Make INSERT policy more permissive (rely on trigger to set defaults), and ensure workspace match
DROP POLICY IF EXISTS "Workspace members create ai projects" ON public.ai_projects;

CREATE POLICY "Workspace members create ai projects"
ON public.ai_projects
FOR INSERT
TO authenticated
WITH CHECK (
  workspace_id = public.get_user_workspace_id()
  AND (created_by IS NULL OR created_by = auth.uid())
);
