-- Leads
CREATE TABLE IF NOT EXISTS public.leads (
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
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT leads_temperature_chk CHECK (temperature IN ('cold','warm','hot')),
  CONSTRAINT leads_status_chk CHECK (status IN ('new','working','qualified','converted','archived'))
);
CREATE INDEX IF NOT EXISTS idx_leads_workspace ON public.leads(workspace_id);
CREATE INDEX IF NOT EXISTS idx_leads_owner ON public.leads(owner_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "leads_select" ON public.leads;
CREATE POLICY "leads_select" ON public.leads FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "leads_insert" ON public.leads;
CREATE POLICY "leads_insert" ON public.leads FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
DROP POLICY IF EXISTS "leads_update" ON public.leads;
CREATE POLICY "leads_update" ON public.leads FOR UPDATE TO authenticated USING (auth.uid() = owner_id OR auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "leads_delete" ON public.leads;
CREATE POLICY "leads_delete" ON public.leads FOR DELETE TO authenticated USING (auth.uid() = owner_id OR auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS update_leads_updated_at ON public.leads;
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- CRM transactions
CREATE TABLE IF NOT EXISTS public.crm_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID,
  deal_id UUID REFERENCES public.deals(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  property_address TEXT,
  status TEXT NOT NULL DEFAULT 'under_contract',
  contract_price NUMERIC,
  contract_date DATE,
  close_date DATE,
  buyer_name TEXT,
  seller_name TEXT,
  title_company TEXT,
  notes TEXT NOT NULL DEFAULT '',
  files JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_crm_transactions_workspace ON public.crm_transactions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_crm_transactions_deal ON public.crm_transactions(deal_id);

ALTER TABLE public.crm_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "crm_transactions_select" ON public.crm_transactions;
CREATE POLICY "crm_transactions_select" ON public.crm_transactions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "crm_transactions_insert" ON public.crm_transactions;
CREATE POLICY "crm_transactions_insert" ON public.crm_transactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
DROP POLICY IF EXISTS "crm_transactions_update" ON public.crm_transactions;
CREATE POLICY "crm_transactions_update" ON public.crm_transactions FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "crm_transactions_delete" ON public.crm_transactions;
CREATE POLICY "crm_transactions_delete" ON public.crm_transactions FOR DELETE TO authenticated USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS trg_crm_transactions_updated ON public.crm_transactions;
CREATE TRIGGER trg_crm_transactions_updated BEFORE UPDATE ON public.crm_transactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();;
