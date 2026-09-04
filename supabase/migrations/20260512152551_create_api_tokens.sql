
CREATE TABLE IF NOT EXISTS public.api_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  name TEXT NOT NULL,
  prefix TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.api_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace members can view api_tokens"
  ON public.api_tokens FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "workspace members can insert api_tokens"
  ON public.api_tokens FOR INSERT
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "workspace members can update api_tokens"
  ON public.api_tokens FOR UPDATE
  USING (workspace_id IN (SELECT workspace_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "workspace members can delete api_tokens"
  ON public.api_tokens FOR DELETE
  USING (workspace_id IN (SELECT workspace_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.api_token_touch(_token_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.api_tokens SET last_used_at = now() WHERE id = _token_id;
END;
$$;
;
