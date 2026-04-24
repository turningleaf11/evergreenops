-- Per-list API keys
CREATE TABLE public.database_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  database_id uuid NOT NULL REFERENCES public.databases_meta(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL,
  label text NOT NULL DEFAULT 'API key',
  key_prefix text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE INDEX idx_database_api_keys_db ON public.database_api_keys(database_id);
CREATE INDEX idx_database_api_keys_hash ON public.database_api_keys(key_hash);

ALTER TABLE public.database_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage api keys in their workspace"
ON public.database_api_keys
FOR ALL
TO authenticated
USING (
  workspace_id = public.get_user_workspace_id()
  AND public.has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  workspace_id = public.get_user_workspace_id()
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

-- Per-list webhooks (inbound + outbound)
CREATE TABLE public.database_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  database_id uuid NOT NULL REFERENCES public.databases_meta(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL,
  direction text NOT NULL CHECK (direction IN ('in','out')),
  label text NOT NULL DEFAULT 'Webhook',
  url text,
  secret text NOT NULL,
  events text[] NOT NULL DEFAULT ARRAY['row.created','row.updated','row.deleted']::text[],
  active boolean NOT NULL DEFAULT true,
  last_status int,
  last_delivered_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_database_webhooks_db ON public.database_webhooks(database_id);

ALTER TABLE public.database_webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage webhooks in their workspace"
ON public.database_webhooks
FOR ALL
TO authenticated
USING (
  workspace_id = public.get_user_workspace_id()
  AND public.has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  workspace_id = public.get_user_workspace_id()
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

-- Webhook delivery log
CREATE TABLE public.database_webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id uuid NOT NULL REFERENCES public.database_webhooks(id) ON DELETE CASCADE,
  event text NOT NULL,
  status_code int,
  response_excerpt text,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_webhook_deliveries_webhook ON public.database_webhook_deliveries(webhook_id, created_at DESC);

ALTER TABLE public.database_webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view deliveries in their workspace"
ON public.database_webhook_deliveries
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.database_webhooks w
    WHERE w.id = webhook_id
      AND w.workspace_id = public.get_user_workspace_id()
      AND public.has_role(auth.uid(), 'admin'::app_role)
  )
);

CREATE POLICY "Admins insert deliveries in their workspace"
ON public.database_webhook_deliveries
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.database_webhooks w
    WHERE w.id = webhook_id
      AND w.workspace_id = public.get_user_workspace_id()
      AND public.has_role(auth.uid(), 'admin'::app_role)
  )
);

-- Trim deliveries to last 50 per webhook
CREATE OR REPLACE FUNCTION public.trim_webhook_deliveries()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.database_webhook_deliveries
  WHERE webhook_id = NEW.webhook_id
    AND id NOT IN (
      SELECT id FROM public.database_webhook_deliveries
      WHERE webhook_id = NEW.webhook_id
      ORDER BY created_at DESC
      LIMIT 50
    );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trim_webhook_deliveries_trg
AFTER INSERT ON public.database_webhook_deliveries
FOR EACH ROW EXECUTE FUNCTION public.trim_webhook_deliveries();