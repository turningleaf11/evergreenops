
-- Pipelines
CREATE TABLE IF NOT EXISTS public.pipelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Pipeline stages
CREATE TABLE IF NOT EXISTS public.pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id UUID NOT NULL REFERENCES public.pipelines(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  sort_order INTEGER NOT NULL DEFAULT 0,
  probability_default INTEGER NOT NULL DEFAULT 0,
  is_won BOOLEAN NOT NULL DEFAULT false,
  is_lost BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Deals
CREATE TABLE IF NOT EXISTS public.deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  pipeline_id UUID NOT NULL REFERENCES public.pipelines(id) ON DELETE CASCADE,
  stage_id UUID NOT NULL REFERENCES public.pipeline_stages(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  value NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  probability INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open',
  lane TEXT NOT NULL DEFAULT 'default',
  owner_id UUID REFERENCES auth.users(id),
  created_by UUID REFERENCES auth.users(id),
  primary_contact_id UUID,
  source_contact_id UUID,
  company_id UUID,
  lead_id UUID,
  department_id UUID REFERENCES public.departments(id),
  expected_close_date DATE,
  stage_entered_at TIMESTAMPTZ,
  lost_reason TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  custom_fields JSONB NOT NULL DEFAULT '{}',
  -- REI-specific fields
  property_address TEXT,
  property_city TEXT,
  property_state TEXT,
  property_zip TEXT,
  property_type TEXT,
  units INTEGER,
  unit_mix TEXT,
  asking_price NUMERIC,
  mao NUMERIC,
  quick_arv NUMERIC,
  repair_estimate NUMERIC,
  our_value NUMERIC,
  our_cap_rate NUMERIC,
  listed_cap_rate NUMERIC,
  noi NUMERIC,
  gross_income NUMERIC,
  effective_gross_income NUMERIC,
  operating_expenses NUMERIC,
  vacancy_rate NUMERIC,
  price_per_unit NUMERIC,
  seller_stated_value NUMERIC,
  spread NUMERIC,
  loi_amount NUMERIC,
  loi_date DATE,
  disposition_strategy TEXT,
  broker_feedback TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace members can manage pipelines"
  ON public.pipelines FOR ALL
  USING (workspace_id IN (SELECT workspace_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "pipeline stages visible to workspace members"
  ON public.pipeline_stages FOR ALL
  USING (pipeline_id IN (SELECT id FROM public.pipelines WHERE workspace_id IN (SELECT workspace_id FROM public.profiles WHERE user_id = auth.uid())));

CREATE POLICY "workspace members can manage deals"
  ON public.deals FOR ALL
  USING (workspace_id IN (SELECT workspace_id FROM public.profiles WHERE user_id = auth.uid()));

-- Seed default Wholesale pipeline with REI stages
WITH ws AS (SELECT id FROM public.workspaces ORDER BY created_at LIMIT 1),
     pl AS (
       INSERT INTO public.pipelines (workspace_id, name, is_default, sort_order)
       SELECT ws.id, 'Wholesale Pipeline', true, 0 FROM ws
       RETURNING id
     )
INSERT INTO public.pipeline_stages (pipeline_id, name, color, sort_order, probability_default, is_won, is_lost)
SELECT pl.id, stage.name, stage.color, stage.ord, stage.prob, stage.won, stage.lost
FROM pl, (VALUES
  ('New Lead',        '#6366f1', 0,  10,  false, false),
  ('Follow Up',       '#f59e0b', 1,  25,  false, false),
  ('Offer Sent',      '#3b82f6', 2,  50,  false, false),
  ('Under Contract',  '#8b5cf6', 3,  75,  false, false),
  ('Closed / Won',    '#10b981', 4, 100,  true,  false),
  ('Dead / Lost',     '#ef4444', 5,   0,  false, true)
) AS stage(name, color, ord, prob, won, lost);
;
