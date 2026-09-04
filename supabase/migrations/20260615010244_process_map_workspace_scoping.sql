
-- Add workspace_id to all process tables
ALTER TABLE public.process_buckets
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE public.process_steps
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE public.process_annotations
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE public.process_edges
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE public.process_improvements
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE public.bucket_projects
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- Backfill all existing rows to Evergreen workspace
UPDATE public.process_buckets      SET workspace_id = 'a8938ed0-9c4e-4d42-b874-593b4b3c90a9' WHERE workspace_id IS NULL;
UPDATE public.process_steps        SET workspace_id = 'a8938ed0-9c4e-4d42-b874-593b4b3c90a9' WHERE workspace_id IS NULL;
UPDATE public.process_annotations  SET workspace_id = 'a8938ed0-9c4e-4d42-b874-593b4b3c90a9' WHERE workspace_id IS NULL;
UPDATE public.process_edges        SET workspace_id = 'a8938ed0-9c4e-4d42-b874-593b4b3c90a9' WHERE workspace_id IS NULL;
UPDATE public.process_improvements SET workspace_id = 'a8938ed0-9c4e-4d42-b874-593b4b3c90a9' WHERE workspace_id IS NULL;
UPDATE public.bucket_projects      SET workspace_id = 'a8938ed0-9c4e-4d42-b874-593b4b3c90a9' WHERE workspace_id IS NULL;

-- Make NOT NULL after backfill
ALTER TABLE public.process_buckets      ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.process_steps        ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.process_annotations  ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.process_edges        ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.process_improvements ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.bucket_projects      ALTER COLUMN workspace_id SET NOT NULL;

-- Drop old permissive policies, replace with workspace-scoped ones
DROP POLICY IF EXISTS "all authenticated users can manage process_buckets" ON public.process_buckets;
DROP POLICY IF EXISTS "all authenticated users can manage process_steps"   ON public.process_steps;
DROP POLICY IF EXISTS "auth_all_process_annotations"                        ON public.process_annotations;
DROP POLICY IF EXISTS "auth_all_process_edges"                              ON public.process_edges;
DROP POLICY IF EXISTS "all authenticated users can manage bucket_projects"  ON public.bucket_projects;
DROP POLICY IF EXISTS "process_improvements_select" ON public.process_improvements;
DROP POLICY IF EXISTS "process_improvements_insert" ON public.process_improvements;
DROP POLICY IF EXISTS "process_improvements_update" ON public.process_improvements;
DROP POLICY IF EXISTS "process_improvements_delete" ON public.process_improvements;

-- process_buckets: all workspace members view; admins manage
CREATE POLICY "workspace_view_process_buckets" ON public.process_buckets FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "admin_manage_process_buckets" ON public.process_buckets FOR ALL
  USING (workspace_id IN (SELECT workspace_id FROM public.profiles WHERE user_id = auth.uid())
    AND public.has_role(auth.uid(), 'admin'));

-- process_steps
CREATE POLICY "workspace_view_process_steps" ON public.process_steps FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "admin_manage_process_steps" ON public.process_steps FOR ALL
  USING (workspace_id IN (SELECT workspace_id FROM public.profiles WHERE user_id = auth.uid())
    AND public.has_role(auth.uid(), 'admin'));

-- process_annotations: all workspace members can add/view; own rows deletable
CREATE POLICY "workspace_view_process_annotations" ON public.process_annotations FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "workspace_insert_process_annotations" ON public.process_annotations FOR INSERT
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "admin_manage_process_annotations" ON public.process_annotations FOR ALL
  USING (workspace_id IN (SELECT workspace_id FROM public.profiles WHERE user_id = auth.uid())
    AND public.has_role(auth.uid(), 'admin'));

-- process_edges
CREATE POLICY "workspace_view_process_edges" ON public.process_edges FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "admin_manage_process_edges" ON public.process_edges FOR ALL
  USING (workspace_id IN (SELECT workspace_id FROM public.profiles WHERE user_id = auth.uid())
    AND public.has_role(auth.uid(), 'admin'));

-- bucket_projects
CREATE POLICY "workspace_view_bucket_projects" ON public.bucket_projects FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "admin_manage_bucket_projects" ON public.bucket_projects FOR ALL
  USING (workspace_id IN (SELECT workspace_id FROM public.profiles WHERE user_id = auth.uid())
    AND public.has_role(auth.uid(), 'admin'));

-- process_improvements: all workspace members can view/insert; admins manage
CREATE POLICY "workspace_view_process_improvements" ON public.process_improvements FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "workspace_insert_process_improvements" ON public.process_improvements FOR INSERT
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "admin_manage_process_improvements" ON public.process_improvements FOR ALL
  USING (workspace_id IN (SELECT workspace_id FROM public.profiles WHERE user_id = auth.uid())
    AND public.has_role(auth.uid(), 'admin'));
;
