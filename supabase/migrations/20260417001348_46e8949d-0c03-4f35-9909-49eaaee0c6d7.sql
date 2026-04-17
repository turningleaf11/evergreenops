
CREATE TABLE public.gmail_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  refresh_token text NOT NULL,
  scopes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gmail_tokens ENABLE ROW LEVEL SECURITY;
-- No policies => no authenticated/anon access. Only service role can read/write.

CREATE TRIGGER trg_gmail_tokens_updated
BEFORE UPDATE ON public.gmail_tokens
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
