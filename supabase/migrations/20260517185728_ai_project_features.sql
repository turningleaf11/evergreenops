CREATE TABLE IF NOT EXISTS public.ai_project_features (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.ai_projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'idea',
  priority TEXT NOT NULL DEFAULT 'medium',
  sort_order INT NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ai_project_features_status_chk CHECK (status IN ('idea','planned','building','done','dropped'))
);
CREATE INDEX IF NOT EXISTS ai_project_features_project_idx ON public.ai_project_features(project_id, sort_order);

ALTER TABLE public.ai_project_features ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_project_features_select" ON public.ai_project_features;
CREATE POLICY "ai_project_features_select" ON public.ai_project_features FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "ai_project_features_modify" ON public.ai_project_features;
CREATE POLICY "ai_project_features_modify" ON public.ai_project_features FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS ai_project_features_set_updated ON public.ai_project_features;
CREATE TRIGGER ai_project_features_set_updated BEFORE UPDATE ON public.ai_project_features FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();;
