
INSERT INTO public.addon_packs (slug, name, description, icon, price_tier, is_active)
VALUES ('ai-workshop', 'AI Workshop', 'Organize every AI project from idea to live app — links, prompts, notes, and stages in one place.', 'Sparkles', 'free', true)
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, icon = EXCLUDED.icon, is_active = true;

CREATE TABLE public.ai_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  stage text NOT NULL DEFAULT 'idea',
  platforms text[] NOT NULL DEFAULT '{}',
  tags text[] NOT NULL DEFAULT '{}',
  live_url text,
  repo_url text,
  prompt text,
  notes_content text,
  cover_url text,
  owner_id uuid,
  created_by uuid NOT NULL,
  visibility text NOT NULL DEFAULT 'workspace',
  shared_department_ids text[] NOT NULL DEFAULT '{}',
  shared_member_ids uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_projects_workspace ON public.ai_projects(workspace_id);
CREATE INDEX idx_ai_projects_owner ON public.ai_projects(owner_id);

CREATE TABLE public.ai_project_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.ai_projects(id) ON DELETE CASCADE,
  label text NOT NULL,
  url text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_project_links_project ON public.ai_project_links(project_id);

CREATE TABLE public.ai_project_collaborators (
  project_id uuid NOT NULL REFERENCES public.ai_projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);

CREATE TABLE public.ai_project_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  project_id uuid NOT NULL REFERENCES public.ai_projects(id) ON DELETE CASCADE,
  uploaded_by uuid,
  name text NOT NULL,
  url text NOT NULL,
  storage_path text,
  size_bytes bigint,
  mime_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_project_files_project ON public.ai_project_files(project_id);

CREATE TRIGGER trg_ai_projects_updated_at
BEFORE UPDATE ON public.ai_projects
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.is_ai_project_collaborator(_project_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.ai_project_collaborators WHERE project_id = _project_id AND user_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION public.can_access_ai_project(_project_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.ai_projects p
    LEFT JOIN public.profiles pr ON pr.user_id = _user_id
    WHERE p.id = _project_id
      AND p.workspace_id = pr.workspace_id
      AND (
        public.has_role(_user_id, 'admin'::app_role)
        OR p.owner_id = _user_id
        OR p.created_by = _user_id
        OR public.is_ai_project_collaborator(p.id, _user_id)
        OR p.visibility = 'workspace'
        OR (p.visibility = 'departments' AND pr.department_id = ANY(p.shared_department_ids))
        OR (p.visibility = 'private' AND _user_id = ANY(p.shared_member_ids))
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.can_edit_ai_project(_project_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.ai_projects p
    WHERE p.id = _project_id
      AND (
        public.has_role(_user_id, 'admin'::app_role)
        OR p.owner_id = _user_id
        OR p.created_by = _user_id
        OR public.is_ai_project_collaborator(p.id, _user_id)
      )
  )
$$;

ALTER TABLE public.ai_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_project_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_project_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_project_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View accessible ai projects" ON public.ai_projects FOR SELECT TO authenticated
USING (workspace_id = public.get_user_workspace_id() AND public.can_access_ai_project(id, auth.uid()));

CREATE POLICY "Workspace members create ai projects" ON public.ai_projects FOR INSERT TO authenticated
WITH CHECK (workspace_id = public.get_user_workspace_id() AND created_by = auth.uid());

CREATE POLICY "Editors update ai projects" ON public.ai_projects FOR UPDATE TO authenticated
USING (public.can_edit_ai_project(id, auth.uid()));

CREATE POLICY "Editors delete ai projects" ON public.ai_projects FOR DELETE TO authenticated
USING (public.can_edit_ai_project(id, auth.uid()));

CREATE POLICY "View links of accessible projects" ON public.ai_project_links FOR SELECT TO authenticated
USING (public.can_access_ai_project(project_id, auth.uid()));
CREATE POLICY "Editors manage links" ON public.ai_project_links FOR ALL TO authenticated
USING (public.can_edit_ai_project(project_id, auth.uid()))
WITH CHECK (public.can_edit_ai_project(project_id, auth.uid()));

CREATE POLICY "View collaborators of accessible projects" ON public.ai_project_collaborators FOR SELECT TO authenticated
USING (public.can_access_ai_project(project_id, auth.uid()));
CREATE POLICY "Editors manage collaborators" ON public.ai_project_collaborators FOR ALL TO authenticated
USING (public.can_edit_ai_project(project_id, auth.uid()))
WITH CHECK (public.can_edit_ai_project(project_id, auth.uid()));

CREATE POLICY "View files of accessible projects" ON public.ai_project_files FOR SELECT TO authenticated
USING (public.can_access_ai_project(project_id, auth.uid()));
CREATE POLICY "Editors add files" ON public.ai_project_files FOR INSERT TO authenticated
WITH CHECK (workspace_id = public.get_user_workspace_id() AND uploaded_by = auth.uid() AND public.can_edit_ai_project(project_id, auth.uid()));
CREATE POLICY "Editors delete files" ON public.ai_project_files FOR DELETE TO authenticated
USING (public.can_edit_ai_project(project_id, auth.uid()));
