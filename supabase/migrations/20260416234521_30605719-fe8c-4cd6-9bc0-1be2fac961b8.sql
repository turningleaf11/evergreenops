
-- ============================================================
-- Gmail workspace account (one per workspace)
-- ============================================================
CREATE TABLE public.gmail_workspace_account (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL UNIQUE,
  email text NOT NULL,
  refresh_token_secret_id text NOT NULL,
  connected_by uuid,
  connected_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gmail_workspace_account ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage workspace gmail account"
ON public.gmail_workspace_account
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_gmail_workspace_account_updated
BEFORE UPDATE ON public.gmail_workspace_account
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- Gmail access rules (one per workspace)
-- ============================================================
CREATE TABLE public.gmail_access_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL UNIQUE,
  allow_all_admins boolean NOT NULL DEFAULT true,
  allow_all_members boolean NOT NULL DEFAULT false,
  allowed_user_ids uuid[] NOT NULL DEFAULT '{}',
  allowed_roles text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gmail_access_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view access rules"
ON public.gmail_access_rules
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins manage access rules"
ON public.gmail_access_rules
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_gmail_access_rules_updated
BEFORE UPDATE ON public.gmail_access_rules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- Email links (polymorphic — link Gmail threads to records)
-- ============================================================
CREATE TABLE public.email_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  gmail_message_id text,
  gmail_thread_id text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  subject text,
  snippet text,
  linked_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_links_entity ON public.email_links (entity_type, entity_id);
CREATE INDEX idx_email_links_thread ON public.email_links (gmail_thread_id);

ALTER TABLE public.email_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view email links"
ON public.email_links
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated create email links"
ON public.email_links
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = linked_by);

CREATE POLICY "Creators delete email links"
ON public.email_links
FOR DELETE
TO authenticated
USING (auth.uid() = linked_by OR has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- can_use_gmail(_user_id) — checks role + allowlist
-- ============================================================
CREATE OR REPLACE FUNCTION public.can_use_gmail(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ws_id uuid;
  rules public.gmail_access_rules%ROWTYPE;
  user_is_admin boolean;
  has_account boolean;
BEGIN
  IF _user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT workspace_id INTO ws_id FROM public.profiles WHERE user_id = _user_id LIMIT 1;
  IF ws_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.gmail_workspace_account
    WHERE workspace_id = ws_id AND revoked_at IS NULL
  ) INTO has_account;
  IF NOT has_account THEN
    RETURN false;
  END IF;

  SELECT * INTO rules FROM public.gmail_access_rules WHERE workspace_id = ws_id LIMIT 1;
  IF NOT FOUND THEN
    -- Default: only admins
    RETURN public.has_role(_user_id, 'admin'::app_role);
  END IF;

  user_is_admin := public.has_role(_user_id, 'admin'::app_role);

  IF rules.allow_all_admins AND user_is_admin THEN
    RETURN true;
  END IF;

  IF rules.allow_all_members THEN
    RETURN true;
  END IF;

  IF _user_id = ANY(rules.allowed_user_ids) THEN
    RETURN true;
  END IF;

  IF user_is_admin AND 'admin' = ANY(rules.allowed_roles) THEN
    RETURN true;
  END IF;

  IF (NOT user_is_admin) AND 'user' = ANY(rules.allowed_roles) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;
