-- Strategy Translations
CREATE TABLE public.strategy_translations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  strategy_item_id UUID NOT NULL REFERENCES public.strategy_items(id) ON DELETE CASCADE,
  department_id TEXT NOT NULL,
  meaning TEXT DEFAULT '',
  immediate_changes TEXT DEFAULT '',
  priorities TEXT[] DEFAULT '{}',
  actions TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.strategy_translations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view translations" ON public.strategy_translations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create translations" ON public.strategy_translations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admins can manage translations" ON public.strategy_translations FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Upward Proposals
CREATE TABLE public.upward_proposals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'strategy_change',
  department_id TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  reasoning TEXT DEFAULT '',
  recommendation TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  ceo_response TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.upward_proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view proposals" ON public.upward_proposals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create proposals" ON public.upward_proposals FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admins can manage proposals" ON public.upward_proposals FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER update_upward_proposals_updated_at BEFORE UPDATE ON public.upward_proposals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
