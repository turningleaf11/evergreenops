-- Companies
CREATE TABLE IF NOT EXISTS public.companies (
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
CREATE INDEX IF NOT EXISTS idx_companies_workspace ON public.companies(workspace_id);
CREATE INDEX IF NOT EXISTS idx_companies_domain ON public.companies(lower(domain));
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "companies_select" ON public.companies;
CREATE POLICY "companies_select" ON public.companies FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "companies_insert" ON public.companies;
CREATE POLICY "companies_insert" ON public.companies FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
DROP POLICY IF EXISTS "companies_update" ON public.companies;
CREATE POLICY "companies_update" ON public.companies FOR UPDATE TO authenticated USING (auth.uid() = owner_id OR auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "companies_delete" ON public.companies;
CREATE POLICY "companies_delete" ON public.companies FOR DELETE TO authenticated USING (auth.uid() = owner_id OR auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'::app_role));
DROP TRIGGER IF EXISTS trg_companies_updated ON public.companies;
CREATE TRIGGER trg_companies_updated BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Contacts
CREATE TABLE IF NOT EXISTS public.contacts (
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
  status TEXT NOT NULL DEFAULT 'lead',
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
CREATE INDEX IF NOT EXISTS idx_contacts_workspace ON public.contacts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON public.contacts(lower(email));
CREATE INDEX IF NOT EXISTS idx_contacts_company ON public.contacts(company_id);
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "contacts_select" ON public.contacts;
CREATE POLICY "contacts_select" ON public.contacts FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "contacts_insert" ON public.contacts;
CREATE POLICY "contacts_insert" ON public.contacts FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
DROP POLICY IF EXISTS "contacts_update" ON public.contacts;
CREATE POLICY "contacts_update" ON public.contacts FOR UPDATE TO authenticated USING (auth.uid() = owner_id OR auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "contacts_delete" ON public.contacts;
CREATE POLICY "contacts_delete" ON public.contacts FOR DELETE TO authenticated USING (auth.uid() = owner_id OR auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'::app_role));
DROP TRIGGER IF EXISTS trg_contacts_updated ON public.contacts;
CREATE TRIGGER trg_contacts_updated BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- CRM Activities (timeline)
CREATE TABLE IF NOT EXISTS public.crm_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  type TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  duration_minutes INTEGER,
  actor_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_crm_activities_entity ON public.crm_activities(entity_type, entity_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_activities_workspace ON public.crm_activities(workspace_id);
ALTER TABLE public.crm_activities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "crm_activities_select" ON public.crm_activities;
CREATE POLICY "crm_activities_select" ON public.crm_activities FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "crm_activities_insert" ON public.crm_activities;
CREATE POLICY "crm_activities_insert" ON public.crm_activities FOR INSERT TO authenticated WITH CHECK (auth.uid() = actor_id OR actor_id IS NULL);
DROP POLICY IF EXISTS "crm_activities_update" ON public.crm_activities;
CREATE POLICY "crm_activities_update" ON public.crm_activities FOR UPDATE TO authenticated USING (auth.uid() = actor_id OR public.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "crm_activities_delete" ON public.crm_activities;
CREATE POLICY "crm_activities_delete" ON public.crm_activities FOR DELETE TO authenticated USING (auth.uid() = actor_id OR public.has_role(auth.uid(), 'admin'::app_role));;
