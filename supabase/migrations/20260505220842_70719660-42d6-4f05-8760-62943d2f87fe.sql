CREATE TABLE public.ai_tools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  name text NOT NULL,
  url text,
  login_email text,
  login_username text,
  login_password text,
  notes text,
  color text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, name)
);

CREATE INDEX idx_ai_tools_workspace ON public.ai_tools(workspace_id);

ALTER TABLE public.ai_tools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_tools select same workspace"
ON public.ai_tools FOR SELECT TO authenticated
USING (workspace_id = public.get_user_workspace_id());

CREATE POLICY "ai_tools insert same workspace"
ON public.ai_tools FOR INSERT TO authenticated
WITH CHECK (workspace_id = public.get_user_workspace_id() AND created_by = auth.uid());

CREATE POLICY "ai_tools update same workspace"
ON public.ai_tools FOR UPDATE TO authenticated
USING (workspace_id = public.get_user_workspace_id())
WITH CHECK (workspace_id = public.get_user_workspace_id());

CREATE POLICY "ai_tools delete admin or creator"
ON public.ai_tools FOR DELETE TO authenticated
USING (
  workspace_id = public.get_user_workspace_id()
  AND (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
);

CREATE OR REPLACE FUNCTION public.ai_tools_set_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  ws uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be signed in';
  END IF;
  SELECT workspace_id INTO ws FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
  IF ws IS NULL THEN
    RAISE EXCEPTION 'Your account is not assigned to a workspace';
  END IF;
  NEW.workspace_id := ws;
  NEW.created_by := auth.uid();
  RETURN NEW;
END;
$$;

CREATE TRIGGER ai_tools_set_defaults_trg
BEFORE INSERT ON public.ai_tools
FOR EACH ROW EXECUTE FUNCTION public.ai_tools_set_defaults();

CREATE TRIGGER ai_tools_updated_at_trg
BEFORE UPDATE ON public.ai_tools
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();