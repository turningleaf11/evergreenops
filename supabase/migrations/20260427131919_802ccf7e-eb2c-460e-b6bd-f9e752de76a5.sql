-- Markets catalog (workspace-scoped, case-insensitive unique)
CREATE TABLE IF NOT EXISTS public.crm_markets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  name text NOT NULL,
  name_normalized text GENERATED ALWAYS AS (lower(btrim(name))) STORED,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS crm_markets_ws_norm_uniq
  ON public.crm_markets (workspace_id, name_normalized);

CREATE INDEX IF NOT EXISTS crm_markets_ws_idx
  ON public.crm_markets (workspace_id);

ALTER TABLE public.crm_markets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view markets"
  ON public.crm_markets FOR SELECT
  USING (workspace_id = public.get_user_workspace_id());

CREATE POLICY "Workspace members can add markets"
  ON public.crm_markets FOR INSERT
  WITH CHECK (workspace_id = public.get_user_workspace_id());

CREATE POLICY "Workspace members can update markets"
  ON public.crm_markets FOR UPDATE
  USING (workspace_id = public.get_user_workspace_id())
  WITH CHECK (workspace_id = public.get_user_workspace_id());

CREATE POLICY "Workspace members can delete markets"
  ON public.crm_markets FOR DELETE
  USING (workspace_id = public.get_user_workspace_id());

CREATE TRIGGER trg_crm_markets_updated_at
  BEFORE UPDATE ON public.crm_markets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Backfill: collect all distinct markets currently in use on contacts
INSERT INTO public.crm_markets (workspace_id, name)
SELECT DISTINCT c.workspace_id, btrim(m) AS name
FROM public.contacts c
CROSS JOIN LATERAL unnest(COALESCE(c.markets, '{}'::text[])) AS m
WHERE c.workspace_id IS NOT NULL
  AND btrim(m) <> ''
ON CONFLICT (workspace_id, name_normalized) DO NOTHING;