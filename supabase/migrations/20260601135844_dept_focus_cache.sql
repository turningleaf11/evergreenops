-- Cache for Albus-generated "Today's Focus" priorities per dept per week.
-- The focus is for the WHOLE team (not per-user) — one synthesis per dept per week.
-- Admin can force regeneration via "Refresh" which deletes the row and re-asks Albus.

CREATE TABLE IF NOT EXISTS public.dept_focus_cache (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id   UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL,
  priorities      JSONB NOT NULL DEFAULT '[]'::jsonb,
  generated_by    UUID,
  generated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (department_id, week_start_date)
);

CREATE INDEX IF NOT EXISTS idx_dept_focus_dept_week
  ON public.dept_focus_cache(department_id, week_start_date DESC);

ALTER TABLE public.dept_focus_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dept_focus_select" ON public.dept_focus_cache;
CREATE POLICY "dept_focus_select" ON public.dept_focus_cache
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "dept_focus_admin_write" ON public.dept_focus_cache;
CREATE POLICY "dept_focus_admin_write" ON public.dept_focus_cache
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));;
