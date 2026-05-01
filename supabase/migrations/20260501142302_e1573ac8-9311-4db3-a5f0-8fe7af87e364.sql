
-- Lead Intake Sources
CREATE TABLE public.lead_intake_sources (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL,
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('form','webhook')),
  slug text NOT NULL UNIQUE,
  secret text NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  active boolean NOT NULL DEFAULT true,
  default_source_label text,
  field_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  submission_count integer NOT NULL DEFAULT 0,
  last_submission_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_lis_workspace ON public.lead_intake_sources(workspace_id);
CREATE INDEX idx_lis_slug ON public.lead_intake_sources(slug);

ALTER TABLE public.lead_intake_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members view intake sources"
ON public.lead_intake_sources FOR SELECT TO authenticated
USING (workspace_id = public.get_user_workspace_id());

CREATE POLICY "Admins manage intake sources"
ON public.lead_intake_sources FOR ALL TO authenticated
USING (workspace_id = public.get_user_workspace_id() AND public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (workspace_id = public.get_user_workspace_id() AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_lis_updated_at
BEFORE UPDATE ON public.lead_intake_sources
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Submissions log
CREATE TABLE public.lead_intake_submissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_id uuid NOT NULL REFERENCES public.lead_intake_sources(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL,
  lead_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip text,
  user_agent text,
  status text NOT NULL DEFAULT 'ok' CHECK (status IN ('ok','error','rejected')),
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_lisub_source ON public.lead_intake_submissions(source_id, created_at DESC);
CREATE INDEX idx_lisub_workspace ON public.lead_intake_submissions(workspace_id, created_at DESC);

ALTER TABLE public.lead_intake_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members view intake submissions"
ON public.lead_intake_submissions FOR SELECT TO authenticated
USING (workspace_id = public.get_user_workspace_id());

CREATE POLICY "Admins manage intake submissions"
ON public.lead_intake_submissions FOR ALL TO authenticated
USING (workspace_id = public.get_user_workspace_id() AND public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (workspace_id = public.get_user_workspace_id() AND public.has_role(auth.uid(), 'admin'::app_role));

-- Public lookup helper (returns minimal info needed to render a public form)
CREATE OR REPLACE FUNCTION public.lead_intake_get_public_form(_slug text)
RETURNS TABLE(id uuid, name text, kind text, active boolean, field_config jsonb, workspace_id uuid)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, name, kind, active, field_config, workspace_id
    FROM public.lead_intake_sources
   WHERE slug = _slug AND kind = 'form' AND active = true
   LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.lead_intake_get_public_form(text) TO anon, authenticated;
