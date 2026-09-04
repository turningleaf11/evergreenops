-- Followers (watchers) on goals, projects, tasks. Distinct from owners
-- (the single accountable person) and from assignees on projects (who
-- actively do the work). Followers receive notifications and see the
-- item in their watched feed but aren't on the hook for delivery.

ALTER TABLE public.goals
  ADD COLUMN IF NOT EXISTS followers uuid[] NOT NULL DEFAULT '{}'::uuid[];

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS followers uuid[] NOT NULL DEFAULT '{}'::uuid[];

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS followers uuid[] NOT NULL DEFAULT '{}'::uuid[];

-- GIN indexes so "show me everything I follow" stays cheap as the team grows
CREATE INDEX IF NOT EXISTS idx_goals_followers    ON public.goals    USING GIN (followers);
CREATE INDEX IF NOT EXISTS idx_projects_followers ON public.projects USING GIN (followers);
CREATE INDEX IF NOT EXISTS idx_tasks_followers    ON public.tasks    USING GIN (followers);;
