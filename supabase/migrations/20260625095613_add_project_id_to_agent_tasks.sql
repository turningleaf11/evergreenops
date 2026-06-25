-- Lets AI agent tasks belong to a project, same as human tasks, so they
-- can be grouped/filtered by project and show up correctly inside a
-- project's task list, not just on the standalone Execution Hub board.
ALTER TABLE public.agent_tasks ADD COLUMN project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;
