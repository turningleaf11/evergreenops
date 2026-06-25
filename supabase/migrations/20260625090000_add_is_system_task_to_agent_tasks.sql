-- Distinguishes low-signal scheduled/operational agent tasks (e.g. recurring
-- syncs, hygiene checks) from meaningful agent work, so the unified Execution
-- Hub task board can hide them by default without deleting them.
ALTER TABLE public.agent_tasks ADD COLUMN is_system_task boolean NOT NULL DEFAULT false;
