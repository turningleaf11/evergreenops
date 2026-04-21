-- scorecard_metrics
CREATE TABLE public.scorecard_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  owner_id uuid,
  weekly_target numeric NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'count',
  data_source text NOT NULL DEFAULT 'manual',
  ghl_field_key text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.scorecard_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view metrics"
  ON public.scorecard_metrics FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage metrics"
  ON public.scorecard_metrics FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER scorecard_metrics_updated_at
  BEFORE UPDATE ON public.scorecard_metrics
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- scorecard_entries
CREATE TABLE public.scorecard_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_id uuid NOT NULL REFERENCES public.scorecard_metrics(id) ON DELETE CASCADE,
  week_start_date date NOT NULL,
  actual_value numeric,
  entered_by uuid,
  entered_at timestamptz NOT NULL DEFAULT now(),
  note text,
  UNIQUE (metric_id, week_start_date)
);

ALTER TABLE public.scorecard_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view entries"
  ON public.scorecard_entries FOR SELECT TO authenticated USING (true);

CREATE POLICY "Owner or admin insert entries"
  ON public.scorecard_entries FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.scorecard_metrics m
      WHERE m.id = scorecard_entries.metric_id AND m.owner_id = auth.uid()
    )
  );

CREATE POLICY "Owner or admin update entries"
  ON public.scorecard_entries FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.scorecard_metrics m
      WHERE m.id = scorecard_entries.metric_id AND m.owner_id = auth.uid()
    )
  );

CREATE POLICY "Owner or admin delete entries"
  ON public.scorecard_entries FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.scorecard_metrics m
      WHERE m.id = scorecard_entries.metric_id AND m.owner_id = auth.uid()
    )
  );

CREATE INDEX idx_scorecard_metrics_dept ON public.scorecard_metrics(department_id);
CREATE INDEX idx_scorecard_entries_metric_week ON public.scorecard_entries(metric_id, week_start_date);

-- Seed 5 company-wide manual metrics for the (single) workspace
INSERT INTO public.scorecard_metrics (workspace_id, department_id, name, unit, weekly_target, data_source, sort_order)
SELECT w.id, NULL, m.name, m.unit, 0, 'manual', m.sort_order
FROM public.workspaces w
CROSS JOIN (VALUES
  ('Leads / New Contacts', 'count', 1),
  ('Calls Made', 'count', 2),
  ('Offers Made', 'count', 3),
  ('Deals Closed', 'count', 4),
  ('Revenue / Assignment Fees', '$', 5)
) AS m(name, unit, sort_order)
ORDER BY w.created_at ASC
LIMIT 50;