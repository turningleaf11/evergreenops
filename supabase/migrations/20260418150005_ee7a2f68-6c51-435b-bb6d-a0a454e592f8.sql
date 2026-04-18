
CREATE TABLE public.markets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  location text DEFAULT '',
  strategy text DEFAULT '',
  criteria text DEFAULT '',
  notes_html text DEFAULT '',
  links jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.markets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members view markets" ON public.markets
  FOR SELECT TO authenticated
  USING (workspace_id = public.get_user_workspace_id());

CREATE POLICY "Workspace members create markets" ON public.markets
  FOR INSERT TO authenticated
  WITH CHECK (workspace_id = public.get_user_workspace_id() AND auth.uid() = created_by);

CREATE POLICY "Workspace members update markets" ON public.markets
  FOR UPDATE TO authenticated
  USING (workspace_id = public.get_user_workspace_id());

CREATE POLICY "Workspace members delete markets" ON public.markets
  FOR DELETE TO authenticated
  USING (workspace_id = public.get_user_workspace_id());

CREATE TRIGGER update_markets_updated_at
  BEFORE UPDATE ON public.markets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.market_research
  ADD COLUMN market_id uuid REFERENCES public.markets(id) ON DELETE CASCADE;

CREATE INDEX idx_market_research_market_id ON public.market_research(market_id);
CREATE INDEX idx_markets_workspace_id ON public.markets(workspace_id);
