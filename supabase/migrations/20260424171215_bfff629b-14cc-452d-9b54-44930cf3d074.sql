
-- =========================================
-- CRM Foundation
-- =========================================

-- COMPANIES
CREATE TABLE public.companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID,
  name TEXT NOT NULL,
  domain TEXT,
  industry TEXT,
  website TEXT,
  size TEXT,
  address JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT NOT NULL DEFAULT '',
  tags TEXT[] NOT NULL DEFAULT '{}',
  owner_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_companies_workspace ON public.companies(workspace_id);
CREATE INDEX idx_companies_domain ON public.companies(lower(domain));

-- CONTACTS
CREATE TABLE public.contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  email TEXT,
  phone TEXT,
  title TEXT,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  owner_id UUID,
  source TEXT,
  status TEXT NOT NULL DEFAULT 'lead', -- lead | active | customer | lost
  tags TEXT[] NOT NULL DEFAULT '{}',
  address JSONB NOT NULL DEFAULT '{}'::jsonb,
  social JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT NOT NULL DEFAULT '',
  department_id UUID,
  last_contacted_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_contacts_workspace ON public.contacts(workspace_id);
CREATE INDEX idx_contacts_email ON public.contacts(lower(email));
CREATE INDEX idx_contacts_company ON public.contacts(company_id);
CREATE INDEX idx_contacts_owner ON public.contacts(owner_id);

-- PIPELINES
CREATE TABLE public.pipelines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID,
  name TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pipelines_workspace ON public.pipelines(workspace_id);

-- PIPELINE STAGES
CREATE TABLE public.pipeline_stages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pipeline_id UUID NOT NULL REFERENCES public.pipelines(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  probability_default NUMERIC NOT NULL DEFAULT 0,
  color TEXT NOT NULL DEFAULT '220 65% 48%',
  is_won BOOLEAN NOT NULL DEFAULT false,
  is_lost BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pipeline_stages_pipeline ON public.pipeline_stages(pipeline_id);

-- DEALS
CREATE TABLE public.deals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID,
  title TEXT NOT NULL,
  pipeline_id UUID NOT NULL REFERENCES public.pipelines(id) ON DELETE RESTRICT,
  stage_id UUID NOT NULL REFERENCES public.pipeline_stages(id) ON DELETE RESTRICT,
  value NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  probability NUMERIC NOT NULL DEFAULT 0,
  expected_close_date DATE,
  owner_id UUID,
  primary_contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'open', -- open | won | lost
  lost_reason TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  description TEXT NOT NULL DEFAULT '',
  department_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_deals_workspace ON public.deals(workspace_id);
CREATE INDEX idx_deals_pipeline ON public.deals(pipeline_id);
CREATE INDEX idx_deals_stage ON public.deals(stage_id);
CREATE INDEX idx_deals_owner ON public.deals(owner_id);
CREATE INDEX idx_deals_status ON public.deals(status);

-- CRM ACTIVITIES (timeline)
CREATE TABLE public.crm_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID,
  entity_type TEXT NOT NULL, -- contact | deal | company
  entity_id UUID NOT NULL,
  type TEXT NOT NULL, -- call | meeting | note | email | task
  subject TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  duration_minutes INTEGER,
  actor_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_crm_activities_entity ON public.crm_activities(entity_type, entity_id, occurred_at DESC);
CREATE INDEX idx_crm_activities_workspace ON public.crm_activities(workspace_id);

-- =========================================
-- updated_at triggers
-- =========================================
CREATE TRIGGER trg_companies_updated BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_contacts_updated BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_pipelines_updated BEFORE UPDATE ON public.pipelines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_deals_updated BEFORE UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- Auto-bump contact.last_contacted_at on email/call/meeting activity
-- =========================================
CREATE OR REPLACE FUNCTION public.crm_bump_contact_last_contacted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.entity_type = 'contact' AND NEW.type IN ('email','call','meeting') THEN
    UPDATE public.contacts
       SET last_contacted_at = GREATEST(COALESCE(last_contacted_at, NEW.occurred_at), NEW.occurred_at)
     WHERE id = NEW.entity_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_crm_activities_bump_contact
AFTER INSERT ON public.crm_activities
FOR EACH ROW EXECUTE FUNCTION public.crm_bump_contact_last_contacted();

-- =========================================
-- Row Level Security
-- =========================================
ALTER TABLE public.companies        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipelines        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_stages  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_activities   ENABLE ROW LEVEL SECURITY;

-- COMPANIES policies
CREATE POLICY "Authenticated view companies" ON public.companies
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated create companies" ON public.companies
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Owners update companies" ON public.companies
  FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id OR auth.uid() = created_by OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Owners delete companies" ON public.companies
  FOR DELETE TO authenticated
  USING (auth.uid() = owner_id OR auth.uid() = created_by OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage companies" ON public.companies
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- CONTACTS policies
CREATE POLICY "Authenticated view contacts" ON public.contacts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated create contacts" ON public.contacts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Owners update contacts" ON public.contacts
  FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id OR auth.uid() = created_by OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Owners delete contacts" ON public.contacts
  FOR DELETE TO authenticated
  USING (auth.uid() = owner_id OR auth.uid() = created_by OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage contacts" ON public.contacts
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- PIPELINES policies (admin-managed, all members can view)
CREATE POLICY "Authenticated view pipelines" ON public.pipelines
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage pipelines" ON public.pipelines
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- PIPELINE STAGES policies
CREATE POLICY "Authenticated view stages" ON public.pipeline_stages
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage stages" ON public.pipeline_stages
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- DEALS policies
CREATE POLICY "Authenticated view deals" ON public.deals
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated create deals" ON public.deals
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Owners update deals" ON public.deals
  FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id OR auth.uid() = created_by OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Owners delete deals" ON public.deals
  FOR DELETE TO authenticated
  USING (auth.uid() = owner_id OR auth.uid() = created_by OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage deals" ON public.deals
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- CRM ACTIVITIES policies
CREATE POLICY "Authenticated view activities" ON public.crm_activities
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated create activities" ON public.crm_activities
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = actor_id OR actor_id IS NULL);
CREATE POLICY "Actors update activities" ON public.crm_activities
  FOR UPDATE TO authenticated
  USING (auth.uid() = actor_id OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Actors delete activities" ON public.crm_activities
  FOR DELETE TO authenticated
  USING (auth.uid() = actor_id OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage activities" ON public.crm_activities
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- =========================================
-- Seed: default Acquisitions Pipeline + stages
-- =========================================
DO $$
DECLARE
  v_pipeline_id UUID := gen_random_uuid();
BEGIN
  INSERT INTO public.pipelines (id, name, is_default, sort_order)
  VALUES (v_pipeline_id, 'Acquisitions Pipeline', true, 0);

  INSERT INTO public.pipeline_stages (pipeline_id, name, sort_order, probability_default, color, is_won, is_lost) VALUES
    (v_pipeline_id, 'New Lead',        0, 10,  '220 65% 48%', false, false),
    (v_pipeline_id, 'Contacted',       1, 25,  '210 70% 50%', false, false),
    (v_pipeline_id, 'Negotiating',     2, 50,  '40 90% 50%',  false, false),
    (v_pipeline_id, 'Under Contract',  3, 80,  '160 70% 40%', false, false),
    (v_pipeline_id, 'Closed Won',      4, 100, '142 76% 36%', true,  false),
    (v_pipeline_id, 'Closed Lost',     5, 0,   '0 70% 50%',   false, true);
END $$;
