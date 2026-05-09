-- Final small safety layer for execution tables that may already exist in partial form.

ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT 'Untitled goal';
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT 'Untitled project';
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT 'Untitled task';
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT 'Untitled issue';
ALTER TABLE public.cadences ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT 'Untitled cadence';

-- The cadence generator checks for an existing run before insert, but this keeps it idempotent under retries.
CREATE UNIQUE INDEX IF NOT EXISTS idx_cadence_runs_cadence_due_unique
ON public.cadence_runs(cadence_id, due_date);

NOTIFY pgrst, 'reload schema';
