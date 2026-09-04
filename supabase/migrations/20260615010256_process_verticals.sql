
CREATE TABLE IF NOT EXISTS public.process_verticals (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  description  TEXT,
  color        TEXT NOT NULL DEFAULT '#6366f1',
  icon         TEXT,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  visibility   TEXT NOT NULL DEFAULT 'workspace',
  shared_with  JSONB NOT NULL DEFAULT '{"departmentIds": [], "memberIds": []}',
  created_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.process_buckets
  ADD COLUMN IF NOT EXISTS vertical_id UUID REFERENCES public.process_verticals(id) ON DELETE SET NULL;

ALTER TABLE public.process_buckets
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS color TEXT NOT NULL DEFAULT '#6366f1',
  ADD COLUMN IF NOT EXISTS position_x FLOAT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS position_y FLOAT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS node_type TEXT NOT NULL DEFAULT 'area';

ALTER TABLE public.process_buckets
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.process_buckets(id) ON DELETE CASCADE;

ALTER TABLE public.process_verticals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_view_process_verticals" ON public.process_verticals FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "admin_manage_process_verticals" ON public.process_verticals FOR ALL
  USING (workspace_id IN (SELECT workspace_id FROM public.profiles WHERE user_id = auth.uid())
    AND public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.update_process_verticals_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_process_verticals_updated_at
  BEFORE UPDATE ON public.process_verticals
  FOR EACH ROW EXECUTE FUNCTION public.update_process_verticals_updated_at();
;
