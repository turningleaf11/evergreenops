-- Repair core workspace access for People, roles, execution records, cadences, and add-ons.
-- This migration is intentionally defensive for a partially migrated production database.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typnamespace = 'public'::regnamespace AND typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'user');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Workspaces ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'OpsHQ',
  description TEXT,
  logo_url TEXT,
  accent_color TEXT,
  app_style TEXT NOT NULL DEFAULT 'default',
  ceo_page_name TEXT NOT NULL DEFAULT 'CEO Cockpit',
  dept_label TEXT NOT NULL DEFAULT 'Departments',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT 'OpsHQ';
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS accent_color TEXT;
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS app_style TEXT NOT NULL DEFAULT 'default';
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS ceo_page_name TEXT NOT NULL DEFAULT 'CEO Cockpit';
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS dept_label TEXT NOT NULL DEFAULT 'Departments';
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

INSERT INTO public.workspaces (name, description)
SELECT 'OpsHQ', 'EvergreenOps workspace'
WHERE NOT EXISTS (SELECT 1 FROM public.workspaces);

-- Departments -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT 'Building2',
  color TEXT NOT NULL DEFAULT '220 65% 48%',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT 'General';
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS icon TEXT NOT NULL DEFAULT 'Building2';
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS color TEXT NOT NULL DEFAULT '220 65% 48%';
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

UPDATE public.departments
SET workspace_id = (SELECT id FROM public.workspaces ORDER BY created_at LIMIT 1)
WHERE workspace_id IS NULL;

INSERT INTO public.departments (workspace_id, name, description, icon, sort_order)
SELECT (SELECT id FROM public.workspaces ORDER BY created_at LIMIT 1), 'Leadership', 'Company leadership and strategy', 'ShieldCheck', 0
WHERE NOT EXISTS (SELECT 1 FROM public.departments);

-- Profiles and roles ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  full_name TEXT,
  avatar_url TEXT,
  department_id TEXT,
  title TEXT,
  phone TEXT,
  email TEXT,
  bio TEXT,
  reports_to UUID,
  birthday DATE,
  start_date DATE,
  time_clock_enabled BOOLEAN NOT NULL DEFAULT true,
  onboarding_skipped BOOLEAN NOT NULL DEFAULT false,
  onboarding_completed_at TIMESTAMPTZ,
  onboarding_progress JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS department_id TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS reports_to UUID;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birthday DATE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS time_clock_enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_skipped BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_progress JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_user_id_unique ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_workspace_id ON public.profiles(workspace_id);
CREATE INDEX IF NOT EXISTS idx_profiles_department_id ON public.profiles(department_id);

INSERT INTO public.profiles (user_id, workspace_id, full_name, email, department_id, title, time_clock_enabled, created_at, updated_at)
SELECT
  u.id,
  (SELECT id FROM public.workspaces ORDER BY created_at LIMIT 1),
  COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
  u.email,
  (SELECT id::text FROM public.departments ORDER BY sort_order, created_at LIMIT 1),
  'Admin',
  true,
  COALESCE(u.created_at, now()),
  now()
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = u.id);

UPDATE public.profiles p
SET
  workspace_id = COALESCE(p.workspace_id, (SELECT id FROM public.workspaces ORDER BY created_at LIMIT 1)),
  email = COALESCE(p.email, u.email),
  full_name = COALESCE(p.full_name, u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
  department_id = COALESCE(p.department_id, (SELECT id::text FROM public.departments ORDER BY sort_order, created_at LIMIT 1)),
  time_clock_enabled = COALESCE(p.time_clock_enabled, true)
FROM auth.users u
WHERE p.user_id = u.id;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'user',
  is_primary BOOLEAN NOT NULL DEFAULT false
);

ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS role public.app_role NOT NULL DEFAULT 'user';
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_roles_user_role_unique ON public.user_roles(user_id, role);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);

INSERT INTO public.user_roles (user_id, role, is_primary)
SELECT u.id, 'user', false
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id AND r.role = 'user');

WITH first_user AS (
  SELECT u.id
  FROM auth.users u
  ORDER BY u.created_at ASC NULLS LAST, u.id ASC
  LIMIT 1
)
INSERT INTO public.user_roles (user_id, role, is_primary)
SELECT id, 'admin', true FROM first_user
WHERE NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin' AND is_primary = true)
ON CONFLICT (user_id, role) DO UPDATE SET is_primary = true;

UPDATE public.profiles p
SET title = COALESCE(NULLIF(p.title, ''), 'Primary Admin')
WHERE p.user_id IN (SELECT user_id FROM public.user_roles WHERE role = 'admin' AND is_primary = true);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_primary_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'admin' AND is_primary = true
  );
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  default_workspace uuid;
  default_department text;
  should_be_primary boolean;
BEGIN
  SELECT id INTO default_workspace FROM public.workspaces ORDER BY created_at LIMIT 1;
  IF default_workspace IS NULL THEN
    INSERT INTO public.workspaces (name, description) VALUES ('OpsHQ', 'EvergreenOps workspace') RETURNING id INTO default_workspace;
  END IF;

  SELECT id::text INTO default_department FROM public.departments ORDER BY sort_order, created_at LIMIT 1;
  IF default_department IS NULL THEN
    INSERT INTO public.departments (workspace_id, name, description, icon, sort_order)
    VALUES (default_workspace, 'Leadership', 'Company leadership and strategy', 'ShieldCheck', 0)
    RETURNING id::text INTO default_department;
  END IF;

  INSERT INTO public.profiles (user_id, workspace_id, full_name, email, department_id, time_clock_enabled)
  VALUES (
    NEW.id,
    default_workspace,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    default_department,
    true
  )
  ON CONFLICT (user_id) DO UPDATE SET
    email = COALESCE(public.profiles.email, EXCLUDED.email),
    full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name),
    workspace_id = COALESCE(public.profiles.workspace_id, EXCLUDED.workspace_id),
    department_id = COALESCE(public.profiles.department_id, EXCLUDED.department_id),
    updated_at = now();

  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin' AND is_primary = true)
  INTO should_be_primary;

  INSERT INTO public.user_roles (user_id, role, is_primary)
  VALUES (NEW.id, 'user', false)
  ON CONFLICT (user_id, role) DO NOTHING;

  IF should_be_primary THEN
    INSERT INTO public.user_roles (user_id, role, is_primary)
    VALUES (NEW.id, 'admin', true)
    ON CONFLICT (user_id, role) DO UPDATE SET is_primary = true;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_profile();

-- Execution hub ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  quarter TEXT NOT NULL DEFAULT 'Q1',
  year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM now())::integer,
  status TEXT NOT NULL DEFAULT 'on_track',
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  progress INTEGER NOT NULL DEFAULT 0,
  measurable_target TEXT NOT NULL DEFAULT '',
  deadline DATE,
  key_results JSONB NOT NULL DEFAULT '[]'::jsonb,
  alignment_notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  goal_id UUID REFERENCES public.goals(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'not_started',
  priority TEXT NOT NULL DEFAULT 'medium',
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  due_date DATE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  assignees TEXT[] NOT NULL DEFAULT '{}',
  notes_content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  goal_id UUID REFERENCES public.goals(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'todo',
  priority TEXT NOT NULL DEFAULT 'medium',
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  due_date DATE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  subtasks JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes_content TEXT NOT NULL DEFAULT '',
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  recurrence_rule JSONB,
  recurring_parent_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  raised_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  priority INTEGER NOT NULL DEFAULT 2,
  status TEXT NOT NULL DEFAULT 'open',
  root_cause TEXT NOT NULL DEFAULT '',
  discussion_notes TEXT NOT NULL DEFAULT '',
  resolution TEXT NOT NULL DEFAULT '',
  resolved_action_type TEXT NOT NULL DEFAULT 'none',
  resolved_action_id UUID,
  category TEXT NOT NULL DEFAULT 'general',
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cadences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  sop_doc_id UUID,
  schedule_type TEXT NOT NULL DEFAULT 'weekly',
  schedule_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  task_template JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cadence_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cadence_id UUID NOT NULL REFERENCES public.cadences(id) ON DELETE CASCADE,
  due_date DATE NOT NULL,
  completed_at TIMESTAMPTZ,
  generated_task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL;
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS quarter TEXT NOT NULL DEFAULT 'Q1';
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM now())::integer;
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'on_track';
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL;
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS progress INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS measurable_target TEXT NOT NULL DEFAULT '';
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS deadline DATE;
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS key_results JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS alignment_notes TEXT NOT NULL DEFAULT '';
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS goal_id UUID REFERENCES public.goals(id) ON DELETE SET NULL;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'not_started';
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'medium';
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS assignees TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS notes_content TEXT NOT NULL DEFAULT '';
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS goal_id UUID REFERENCES public.goals(id) ON DELETE SET NULL;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'todo';
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'medium';
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS subtasks JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS notes_content TEXT NOT NULL DEFAULT '';
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS recurrence_rule JSONB;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS recurring_parent_id UUID;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL;
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS raised_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL;
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS priority INTEGER NOT NULL DEFAULT 2;
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open';
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS root_cause TEXT NOT NULL DEFAULT '';
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS discussion_notes TEXT NOT NULL DEFAULT '';
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS resolution TEXT NOT NULL DEFAULT '';
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS resolved_action_type TEXT NOT NULL DEFAULT 'none';
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS resolved_action_id UUID;
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'general';
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.cadences ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL;
ALTER TABLE public.cadences ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.cadences ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.cadences ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL;
ALTER TABLE public.cadences ADD COLUMN IF NOT EXISTS sop_doc_id UUID;
ALTER TABLE public.cadences ADD COLUMN IF NOT EXISTS schedule_type TEXT NOT NULL DEFAULT 'weekly';
ALTER TABLE public.cadences ADD COLUMN IF NOT EXISTS schedule_config JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.cadences ADD COLUMN IF NOT EXISTS task_template JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.cadences ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.cadences ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.cadences ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.cadences ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.cadence_runs ADD COLUMN IF NOT EXISTS cadence_id UUID REFERENCES public.cadences(id) ON DELETE CASCADE;
ALTER TABLE public.cadence_runs ADD COLUMN IF NOT EXISTS due_date DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE public.cadence_runs ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE public.cadence_runs ADD COLUMN IF NOT EXISTS generated_task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL;
ALTER TABLE public.cadence_runs ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE public.cadence_runs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

DO $$
DECLARE
  default_workspace uuid;
BEGIN
  SELECT id INTO default_workspace FROM public.workspaces ORDER BY created_at LIMIT 1;
  UPDATE public.goals SET workspace_id = COALESCE(workspace_id, default_workspace);
  UPDATE public.projects SET workspace_id = COALESCE(workspace_id, default_workspace);
  UPDATE public.tasks SET workspace_id = COALESCE(workspace_id, default_workspace);
  UPDATE public.issues SET workspace_id = COALESCE(workspace_id, default_workspace);
  UPDATE public.cadences SET workspace_id = COALESCE(workspace_id, default_workspace);
END $$;

CREATE INDEX IF NOT EXISTS idx_goals_workspace_created ON public.goals(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_workspace_created ON public.projects(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_created ON public.tasks(assigned_to, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_issues_status_priority ON public.issues(status, priority, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cadences_workspace_created ON public.cadences(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cadence_runs_cadence_due ON public.cadence_runs(cadence_id, due_date DESC);

-- Add-ons ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.addon_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  price_tier TEXT NOT NULL DEFAULT 'free',
  stripe_price_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workspace_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  addon_id UUID NOT NULL REFERENCES public.addon_packs(id) ON DELETE CASCADE,
  enabled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  enabled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT workspace_addons_workspace_addon_key UNIQUE (workspace_id, addon_id)
);

INSERT INTO public.addon_packs (slug, name, description, icon, price_tier, is_active)
VALUES
  ('time-clock', 'Time Clock', 'Track employee clock-ins, time entries, and time-off requests.', 'Clock', 'free', true),
  ('real-estate-research', 'Market Research', 'Research real estate markets and opportunity areas.', 'Building', 'free', true),
  ('content-studio', 'Content Studio', 'Plan and draft marketing content.', 'Sparkles', 'free', true),
  ('ai-workshop', 'AI Workshop', 'Build and organize AI workflows and experiments.', 'Sparkles', 'free', true)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  is_active = true,
  updated_at = now();

INSERT INTO public.workspace_addons (workspace_id, addon_id)
SELECT w.id, a.id
FROM public.workspaces w
CROSS JOIN public.addon_packs a
WHERE a.slug IN ('time-clock', 'real-estate-research', 'content-studio', 'ai-workshop')
ON CONFLICT (workspace_id, addon_id) DO NOTHING;

-- RLS policies ----------------------------------------------------------------
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cadences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cadence_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addon_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_addons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspaces authenticated read" ON public.workspaces;
CREATE POLICY "workspaces authenticated read" ON public.workspaces FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "workspaces admins write" ON public.workspaces;
CREATE POLICY "workspaces admins write" ON public.workspaces FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "departments authenticated read" ON public.departments;
CREATE POLICY "departments authenticated read" ON public.departments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "departments admins write" ON public.departments;
CREATE POLICY "departments admins write" ON public.departments FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "profiles authenticated read" ON public.profiles;
CREATE POLICY "profiles authenticated read" ON public.profiles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "profiles owner or admin write" ON public.profiles;
CREATE POLICY "profiles owner or admin write" ON public.profiles FOR ALL TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin')) WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "user_roles authenticated read" ON public.user_roles;
CREATE POLICY "user_roles authenticated read" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "user_roles admins write" ON public.user_roles;
CREATE POLICY "user_roles admins write" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "goals authenticated all" ON public.goals;
CREATE POLICY "goals authenticated all" ON public.goals FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "projects authenticated all" ON public.projects;
CREATE POLICY "projects authenticated all" ON public.projects FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "tasks authenticated all" ON public.tasks;
CREATE POLICY "tasks authenticated all" ON public.tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "issues authenticated all" ON public.issues;
CREATE POLICY "issues authenticated all" ON public.issues FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "cadences authenticated all" ON public.cadences;
CREATE POLICY "cadences authenticated all" ON public.cadences FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "cadence_runs authenticated all" ON public.cadence_runs;
CREATE POLICY "cadence_runs authenticated all" ON public.cadence_runs FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "addon_packs authenticated read" ON public.addon_packs;
CREATE POLICY "addon_packs authenticated read" ON public.addon_packs FOR SELECT TO authenticated USING (is_active = true);
DROP POLICY IF EXISTS "addon_packs admins write" ON public.addon_packs;
CREATE POLICY "addon_packs admins write" ON public.addon_packs FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "workspace_addons authenticated read" ON public.workspace_addons;
CREATE POLICY "workspace_addons authenticated read" ON public.workspace_addons FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "workspace_addons admins write" ON public.workspace_addons;
CREATE POLICY "workspace_addons admins write" ON public.workspace_addons FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DO $$
DECLARE
  t text;
  trigger_name text;
BEGIN
  FOREACH t IN ARRAY ARRAY['workspaces', 'departments', 'profiles', 'goals', 'projects', 'tasks', 'issues', 'cadences', 'addon_packs']
  LOOP
    trigger_name := 'set_' || t || '_updated_at';
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = trigger_name) THEN
      EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()', trigger_name, t);
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
