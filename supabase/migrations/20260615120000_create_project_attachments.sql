-- Project file attachments — dedicated table for binary files uploaded to a project.
-- Previously, uploaded files were stored as documents records (workaround).
-- This table replaces that pattern with proper attachment metadata.

CREATE TABLE IF NOT EXISTS public.project_attachments (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  workspace_id UUID        NOT NULL,
  file_name    TEXT        NOT NULL,
  storage_path TEXT        NOT NULL,
  public_url   TEXT        NOT NULL,
  file_size    BIGINT,
  mime_type    TEXT,
  uploaded_by  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_attachments_project_id
  ON public.project_attachments(project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_project_attachments_workspace_id
  ON public.project_attachments(workspace_id);

ALTER TABLE public.project_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project_attachments workspace select" ON public.project_attachments;
CREATE POLICY "project_attachments workspace select"
  ON public.project_attachments FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "project_attachments workspace insert" ON public.project_attachments;
CREATE POLICY "project_attachments workspace insert"
  ON public.project_attachments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "project_attachments workspace delete" ON public.project_attachments;
CREATE POLICY "project_attachments workspace delete"
  ON public.project_attachments FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

NOTIFY pgrst, 'reload schema';
