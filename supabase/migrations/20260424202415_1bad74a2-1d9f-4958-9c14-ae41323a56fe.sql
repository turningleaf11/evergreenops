-- Leads table
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID,
  name TEXT NOT NULL DEFAULT '',
  email TEXT,
  phone TEXT,
  company_name TEXT,
  title TEXT,
  source TEXT,
  temperature TEXT NOT NULL DEFAULT 'warm',
  status TEXT NOT NULL DEFAULT 'new',
  next_action_at TIMESTAMPTZ,
  notes TEXT NOT NULL DEFAULT '',
  owner_id UUID,
  created_by UUID,
  converted_contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  converted_deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
  custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_leads_workspace ON public.leads(workspace_id);
CREATE INDEX idx_leads_owner ON public.leads(owner_id);
CREATE INDEX idx_leads_status ON public.leads(status);
CREATE INDEX idx_leads_temperature ON public.leads(temperature);
CREATE INDEX idx_leads_next_action ON public.leads(next_action_at);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Validation
ALTER TABLE public.leads
  ADD CONSTRAINT leads_temperature_chk CHECK (temperature IN ('cold','warm','hot')),
  ADD CONSTRAINT leads_status_chk CHECK (status IN ('new','working','qualified','converted','archived'));

-- RLS
CREATE POLICY "View accessible leads"
  ON public.leads FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR owner_id = auth.uid()
    OR created_by = auth.uid()
  );

CREATE POLICY "Create leads in workspace"
  ON public.leads FOR INSERT
  TO authenticated
  WITH CHECK (
    workspace_id = public.get_user_workspace_id()
    AND created_by = auth.uid()
  );

CREATE POLICY "Update accessible leads"
  ON public.leads FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR owner_id = auth.uid()
    OR created_by = auth.uid()
  );

CREATE POLICY "Delete owned leads or admin"
  ON public.leads FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR owner_id = auth.uid()
    OR created_by = auth.uid()
  );

CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Stage change activity logger
CREATE OR REPLACE FUNCTION public.deals_log_stage_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stage_name TEXT;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.stage_id IS DISTINCT FROM OLD.stage_id THEN
    SELECT name INTO stage_name FROM public.pipeline_stages WHERE id = NEW.stage_id;
    INSERT INTO public.crm_activities (
      workspace_id, entity_type, entity_id, type, subject, body, actor_id, occurred_at
    ) VALUES (
      NEW.workspace_id,
      'deal',
      NEW.id,
      'stage_change',
      'Stage: ' || COALESCE(stage_name, 'Unknown'),
      '',
      auth.uid(),
      now()
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_deals_log_stage_change
  AFTER UPDATE ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.deals_log_stage_change();