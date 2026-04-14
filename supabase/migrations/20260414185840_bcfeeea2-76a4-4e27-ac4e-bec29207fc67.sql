ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS ceo_page_name text NOT NULL DEFAULT 'CEO Cockpit',
  ADD COLUMN IF NOT EXISTS dept_label text NOT NULL DEFAULT 'Departments';