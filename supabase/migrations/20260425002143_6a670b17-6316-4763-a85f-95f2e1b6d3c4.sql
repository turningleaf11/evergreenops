-- API Tokens table
CREATE TABLE public.api_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  name TEXT NOT NULL,
  prefix TEXT NOT NULL,              -- e.g. "evg_a1b2" (for display)
  token_hash TEXT NOT NULL UNIQUE,   -- sha256 hex of full token
  created_by UUID NOT NULL,
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_api_tokens_workspace ON public.api_tokens(workspace_id);
CREATE INDEX idx_api_tokens_hash ON public.api_tokens(token_hash) WHERE revoked_at IS NULL;

ALTER TABLE public.api_tokens ENABLE ROW LEVEL SECURITY;

-- Admins (in their workspace) can view tokens
CREATE POLICY "Admins view api tokens"
ON public.api_tokens FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  AND workspace_id = public.get_user_workspace_id()
);

-- Admins can create tokens
CREATE POLICY "Admins create api tokens"
ON public.api_tokens FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  AND workspace_id = public.get_user_workspace_id()
  AND created_by = auth.uid()
);

-- Admins can revoke (update) tokens in their workspace
CREATE POLICY "Admins update api tokens"
ON public.api_tokens FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  AND workspace_id = public.get_user_workspace_id()
);

-- Admins can hard-delete tokens
CREATE POLICY "Admins delete api tokens"
ON public.api_tokens FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  AND workspace_id = public.get_user_workspace_id()
);

-- Helper: stamp last_used_at (called from edge function via service role)
CREATE OR REPLACE FUNCTION public.api_token_touch(_token_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.api_tokens SET last_used_at = now() WHERE id = _token_id;
$$;