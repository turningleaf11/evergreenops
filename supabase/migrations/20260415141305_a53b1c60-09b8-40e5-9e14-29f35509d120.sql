
-- 1. Add time_clock_enabled to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS time_clock_enabled boolean NOT NULL DEFAULT false;

-- 2. Add workspace_id to profiles (references workspaces)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL;

-- 3. Add workspace_id to key tables
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.databases_meta ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.polls ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.kudos ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.strategy_items ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- 4. Backfill existing data with the first workspace
DO $$
DECLARE
  default_ws uuid;
BEGIN
  SELECT id INTO default_ws FROM public.workspaces ORDER BY created_at ASC LIMIT 1;
  IF default_ws IS NOT NULL THEN
    UPDATE public.profiles SET workspace_id = default_ws WHERE workspace_id IS NULL;
    UPDATE public.departments SET workspace_id = default_ws WHERE workspace_id IS NULL;
    UPDATE public.projects SET workspace_id = default_ws WHERE workspace_id IS NULL;
    UPDATE public.tasks SET workspace_id = default_ws WHERE workspace_id IS NULL;
    UPDATE public.goals SET workspace_id = default_ws WHERE workspace_id IS NULL;
    UPDATE public.issues SET workspace_id = default_ws WHERE workspace_id IS NULL;
    UPDATE public.documents SET workspace_id = default_ws WHERE workspace_id IS NULL;
    UPDATE public.databases_meta SET workspace_id = default_ws WHERE workspace_id IS NULL;
    UPDATE public.announcements SET workspace_id = default_ws WHERE workspace_id IS NULL;
    UPDATE public.polls SET workspace_id = default_ws WHERE workspace_id IS NULL;
    UPDATE public.posts SET workspace_id = default_ws WHERE workspace_id IS NULL;
    UPDATE public.kudos SET workspace_id = default_ws WHERE workspace_id IS NULL;
    UPDATE public.strategy_items SET workspace_id = default_ws WHERE workspace_id IS NULL;
  END IF;
END $$;

-- 5. Helper function: get workspace_id for current user
CREATE OR REPLACE FUNCTION public.get_user_workspace_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT workspace_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1
$$;

-- 6. Update handle_new_user to support workspace creation on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ws_name text;
  ws_id uuid;
BEGIN
  ws_name := NEW.raw_user_meta_data->>'workspace_name';

  IF ws_name IS NOT NULL AND ws_name <> '' THEN
    -- New SaaS signup: create workspace
    INSERT INTO public.workspaces (name)
    VALUES (ws_name)
    RETURNING id INTO ws_id;

    -- Create profile linked to workspace
    INSERT INTO public.profiles (user_id, full_name, avatar_url, workspace_id)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
      COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
      ws_id
    );

    -- Assign as admin
    INSERT INTO public.user_roles (user_id, role, is_primary)
    VALUES (NEW.id, 'admin', true);
  ELSE
    -- Invited user or legacy signup: find existing workspace
    SELECT id INTO ws_id FROM public.workspaces ORDER BY created_at ASC LIMIT 1;

    INSERT INTO public.profiles (user_id, full_name, avatar_url, workspace_id)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
      COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
      ws_id
    );

    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user');
  END IF;

  RETURN NEW;
END;
$$;

-- 7. Create indexes for workspace_id on key tables
CREATE INDEX IF NOT EXISTS idx_profiles_workspace ON public.profiles(workspace_id);
CREATE INDEX IF NOT EXISTS idx_departments_workspace ON public.departments(workspace_id);
CREATE INDEX IF NOT EXISTS idx_projects_workspace ON public.projects(workspace_id);
CREATE INDEX IF NOT EXISTS idx_tasks_workspace ON public.tasks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_goals_workspace ON public.goals(workspace_id);
CREATE INDEX IF NOT EXISTS idx_issues_workspace ON public.issues(workspace_id);
CREATE INDEX IF NOT EXISTS idx_documents_workspace ON public.documents(workspace_id);
CREATE INDEX IF NOT EXISTS idx_databases_meta_workspace ON public.databases_meta(workspace_id);
