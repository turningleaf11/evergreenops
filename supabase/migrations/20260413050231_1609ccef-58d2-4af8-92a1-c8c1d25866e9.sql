
-- Workspaces
CREATE TABLE public.workspaces (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'TeamSpace',
  description TEXT DEFAULT '',
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view workspaces" ON public.workspaces FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage workspaces" ON public.workspaces FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER update_workspaces_updated_at BEFORE UPDATE ON public.workspaces FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Departments
CREATE TABLE public.departments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  icon TEXT DEFAULT 'Building2',
  color TEXT DEFAULT '220 65% 48%',
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view departments" ON public.departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage departments" ON public.departments FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON public.departments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Documents
CREATE TABLE public.documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT DEFAULT '',
  parent_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  visibility TEXT NOT NULL DEFAULT 'workspace',
  shared_with JSONB DEFAULT '{"departmentIds":[],"memberIds":[]}',
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view documents" ON public.documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create documents" ON public.documents FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Authors can update their documents" ON public.documents FOR UPDATE TO authenticated USING (auth.uid() = author_id);
CREATE POLICY "Admins can manage all documents" ON public.documents FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Databases Meta
CREATE TABLE public.databases_meta (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  icon TEXT DEFAULT 'Database',
  visibility TEXT NOT NULL DEFAULT 'workspace',
  shared_with JSONB DEFAULT '{"departmentIds":[],"memberIds":[]}',
  columns JSONB NOT NULL DEFAULT '[]',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.databases_meta ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view databases" ON public.databases_meta FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create databases" ON public.databases_meta FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Admins can manage all databases" ON public.databases_meta FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER update_databases_meta_updated_at BEFORE UPDATE ON public.databases_meta FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Database Rows
CREATE TABLE public.database_rows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  database_id UUID NOT NULL REFERENCES public.databases_meta(id) ON DELETE CASCADE,
  "values" JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.database_rows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view rows" ON public.database_rows FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create rows" ON public.database_rows FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update rows" ON public.database_rows FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete rows" ON public.database_rows FOR DELETE TO authenticated USING (true);
CREATE TRIGGER update_database_rows_updated_at BEFORE UPDATE ON public.database_rows FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Announcements
CREATE TABLE public.announcements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT DEFAULT '',
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name TEXT,
  pinned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view announcements" ON public.announcements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage announcements" ON public.announcements FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER update_announcements_updated_at BEFORE UPDATE ON public.announcements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Strategy Items
CREATE TABLE public.strategy_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'objective',
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_departments TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.strategy_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view strategy items" ON public.strategy_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage strategy items" ON public.strategy_items FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER update_strategy_items_updated_at BEFORE UPDATE ON public.strategy_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Strategy Responses
CREATE TABLE public.strategy_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  strategy_item_id UUID NOT NULL REFERENCES public.strategy_items(id) ON DELETE CASCADE,
  department_id TEXT,
  responder_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT 'accept',
  ground_truth TEXT DEFAULT '',
  analysis TEXT DEFAULT '',
  recommendation TEXT DEFAULT '',
  expected_impact TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.strategy_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view responses" ON public.strategy_responses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create responses" ON public.strategy_responses FOR INSERT TO authenticated WITH CHECK (auth.uid() = responder_id);
CREATE POLICY "Admins can manage responses" ON public.strategy_responses FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Decision Log
CREATE TABLE public.decision_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  rationale TEXT DEFAULT '',
  outcome TEXT DEFAULT '',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.decision_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view decisions" ON public.decision_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage decisions" ON public.decision_log FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER update_decision_log_updated_at BEFORE UPDATE ON public.decision_log FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Training Modules
CREATE TABLE public.training_modules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  type TEXT NOT NULL DEFAULT 'guide',
  category TEXT NOT NULL DEFAULT 'Onboarding',
  role_ids TEXT[] DEFAULT '{}',
  steps JSONB NOT NULL DEFAULT '[]',
  icon TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.training_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view training modules" ON public.training_modules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage training modules" ON public.training_modules FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER update_training_modules_updated_at BEFORE UPDATE ON public.training_modules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Onboarding Steps
CREATE TABLE public.onboarding_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  link TEXT,
  link_label TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.onboarding_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view onboarding steps" ON public.onboarding_steps FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage onboarding steps" ON public.onboarding_steps FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER update_onboarding_steps_updated_at BEFORE UPDATE ON public.onboarding_steps FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
