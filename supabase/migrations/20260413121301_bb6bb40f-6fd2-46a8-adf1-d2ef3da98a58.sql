
-- ============================================
-- GOALS
-- ============================================
CREATE TABLE public.goals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text DEFAULT '',
  quarter text NOT NULL DEFAULT 'Q1',
  year integer NOT NULL DEFAULT extract(year from now())::integer,
  status text NOT NULL DEFAULT 'on_track',
  owner_id uuid,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  created_by uuid,
  progress integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view goals" ON public.goals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create goals" ON public.goals FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admins can manage goals" ON public.goals FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Owners can update their goals" ON public.goals FOR UPDATE TO authenticated USING (auth.uid() = owner_id);

CREATE TRIGGER update_goals_updated_at BEFORE UPDATE ON public.goals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- PROJECTS
-- ============================================
CREATE TABLE public.projects (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text DEFAULT '',
  goal_id uuid REFERENCES public.goals(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'not_started',
  owner_id uuid,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  due_date date,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view projects" ON public.projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create projects" ON public.projects FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admins can manage projects" ON public.projects FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Owners can update their projects" ON public.projects FOR UPDATE TO authenticated USING (auth.uid() = owner_id);

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- TASKS
-- ============================================
CREATE TABLE public.tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text DEFAULT '',
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  goal_id uuid REFERENCES public.goals(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'todo',
  assigned_to uuid,
  due_date date,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view tasks" ON public.tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create tasks" ON public.tasks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admins can manage tasks" ON public.tasks FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Assignees can update their tasks" ON public.tasks FOR UPDATE TO authenticated USING (auth.uid() = assigned_to);

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- ISSUES
-- ============================================
CREATE TABLE public.issues (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text DEFAULT '',
  raised_by uuid,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  priority integer NOT NULL DEFAULT 2,
  status text NOT NULL DEFAULT 'open',
  root_cause text DEFAULT '',
  discussion_notes text DEFAULT '',
  resolution text DEFAULT '',
  resolved_action_type text DEFAULT 'none',
  resolved_action_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view issues" ON public.issues FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create issues" ON public.issues FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admins can manage issues" ON public.issues FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Creators can update their issues" ON public.issues FOR UPDATE TO authenticated USING (auth.uid() = raised_by);

CREATE TRIGGER update_issues_updated_at BEFORE UPDATE ON public.issues FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- VISION
-- ============================================
CREATE TABLE public.vision (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  section text NOT NULL,
  content jsonb NOT NULL DEFAULT '{}',
  sort_order integer DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.vision ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view vision" ON public.vision FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage vision" ON public.vision FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_vision_updated_at BEFORE UPDATE ON public.vision FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default vision sections
INSERT INTO public.vision (section, content, sort_order) VALUES
  ('core_values', '{"text": ""}'::jsonb, 1),
  ('core_focus_purpose', '{"text": ""}'::jsonb, 2),
  ('core_focus_niche', '{"text": ""}'::jsonb, 3),
  ('ten_year_target', '{"text": ""}'::jsonb, 4),
  ('three_year_picture', '{"text": ""}'::jsonb, 5),
  ('one_year_plan', '{"text": ""}'::jsonb, 6);
