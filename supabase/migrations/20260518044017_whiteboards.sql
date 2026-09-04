CREATE TABLE IF NOT EXISTS public.whiteboards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'Untitled Whiteboard',
  description TEXT NOT NULL DEFAULT '',
  document JSONB,
  cover_color TEXT NOT NULL DEFAULT '#6366f1',
  pinned_project_ids UUID[] NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  workspace_id UUID,
  visibility TEXT NOT NULL DEFAULT 'workspace' CHECK (visibility IN ('private','workspace')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS whiteboards_created_by_idx ON public.whiteboards(created_by);
CREATE INDEX IF NOT EXISTS whiteboards_updated_at_idx ON public.whiteboards(updated_at DESC);

ALTER TABLE public.whiteboards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "whiteboards_select" ON public.whiteboards;
CREATE POLICY "whiteboards_select" ON public.whiteboards FOR SELECT TO authenticated USING (
  visibility = 'workspace' OR auth.uid() = created_by
);
DROP POLICY IF EXISTS "whiteboards_insert" ON public.whiteboards;
CREATE POLICY "whiteboards_insert" ON public.whiteboards FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
DROP POLICY IF EXISTS "whiteboards_update" ON public.whiteboards;
CREATE POLICY "whiteboards_update" ON public.whiteboards FOR UPDATE TO authenticated USING (
  auth.uid() = created_by OR visibility = 'workspace'
);
DROP POLICY IF EXISTS "whiteboards_delete" ON public.whiteboards;
CREATE POLICY "whiteboards_delete" ON public.whiteboards FOR DELETE TO authenticated USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS whiteboards_set_updated ON public.whiteboards;
CREATE TRIGGER whiteboards_set_updated BEFORE UPDATE ON public.whiteboards FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();;
