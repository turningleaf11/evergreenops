-- Ideas backlog (CEO/admin-only authoring; workspace can view)
CREATE TABLE IF NOT EXISTS public.ideas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'captured', -- captured | evaluating | parked | promoted | killed
  theme TEXT DEFAULT '',                    -- AI-suggested cluster
  effort TEXT DEFAULT '',                   -- xs | s | m | l | xl
  horizon TEXT DEFAULT '',                  -- e.g. Q1 2026
  priority_score INTEGER DEFAULT 0,
  dependencies UUID[] NOT NULL DEFAULT '{}',
  tags TEXT[] NOT NULL DEFAULT '{}',
  source_triage_id UUID,                    -- if promoted from triage
  promoted_to_type TEXT,                    -- project | goal | strategy_item
  promoted_to_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ideas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage ideas"
  ON public.ideas
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated view ideas"
  ON public.ideas
  FOR SELECT TO authenticated
  USING (true);

CREATE TRIGGER update_ideas_updated_at
  BEFORE UPDATE ON public.ideas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_ideas_workspace ON public.ideas(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ideas_status ON public.ideas(status);
CREATE INDEX IF NOT EXISTS idx_ideas_theme ON public.ideas(theme);