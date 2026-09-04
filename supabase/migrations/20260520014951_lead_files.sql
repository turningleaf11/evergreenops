CREATE TABLE IF NOT EXISTS public.lead_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  uploaded_by uuid,
  name text NOT NULL,
  url text NOT NULL,
  storage_path text,
  size_bytes bigint,
  mime_type text,
  kind text NOT NULL DEFAULT 'other' CHECK (kind IN ('om','t12','rent_roll','photo','other')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lead_files_lead ON public.lead_files(lead_id);
ALTER TABLE public.lead_files ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Workspace members can view lead files" ON public.lead_files;
CREATE POLICY "Workspace members can view lead files" ON public.lead_files FOR SELECT TO authenticated USING (workspace_id = public.get_user_workspace_id());
DROP POLICY IF EXISTS "Workspace members can add lead files" ON public.lead_files;
CREATE POLICY "Workspace members can add lead files" ON public.lead_files FOR INSERT TO authenticated WITH CHECK (workspace_id = public.get_user_workspace_id() AND uploaded_by = auth.uid());
DROP POLICY IF EXISTS "Workspace members can delete lead files" ON public.lead_files;
CREATE POLICY "Workspace members can delete lead files" ON public.lead_files FOR DELETE TO authenticated USING (workspace_id = public.get_user_workspace_id());;
