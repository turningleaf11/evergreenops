ALTER TABLE public.agent_tasks ADD COLUMN project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;;
