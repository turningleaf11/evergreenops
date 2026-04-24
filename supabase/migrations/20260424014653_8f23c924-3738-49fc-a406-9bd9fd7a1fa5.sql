-- one_on_ones
CREATE TABLE public.one_on_ones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL,
  conducted_by uuid NOT NULL,
  meeting_date date NOT NULL,
  notes text,
  sentiment text NOT NULL DEFAULT 'neutral' CHECK (sentiment IN ('great','good','neutral','concerned','critical')),
  action_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  next_meeting_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_one_on_ones_employee ON public.one_on_ones(employee_id, meeting_date DESC);
CREATE INDEX idx_one_on_ones_workspace ON public.one_on_ones(workspace_id);

ALTER TABLE public.one_on_ones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage one_on_ones" ON public.one_on_ones
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- growth_profiles
CREATE TABLE public.growth_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL,
  company_role_description text,
  seats_owned text[],
  career_goals text,
  personal_rei_goals text,
  skills_developing text[],
  notes text,
  last_updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, employee_id)
);
CREATE INDEX idx_growth_profiles_employee ON public.growth_profiles(employee_id);

ALTER TABLE public.growth_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage growth_profiles" ON public.growth_profiles
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_growth_profiles_updated_at
  BEFORE UPDATE ON public.growth_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- people_health_snapshots
CREATE TABLE public.people_health_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL,
  snapshot_date date NOT NULL,
  one_on_one_frequency_score integer NOT NULL DEFAULT 0,
  last_one_on_one_date date,
  days_since_last_one_on_one integer,
  kudos_received_30_days integer NOT NULL DEFAULT 0,
  open_action_items integer NOT NULL DEFAULT 0,
  onboarding_complete boolean NOT NULL DEFAULT false,
  onboarding_progress_pct integer NOT NULL DEFAULT 0,
  overall_health text NOT NULL DEFAULT 'green' CHECK (overall_health IN ('green','yellow','red')),
  calculated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, employee_id, snapshot_date)
);
CREATE INDEX idx_health_snapshots_employee ON public.people_health_snapshots(employee_id, snapshot_date DESC);

ALTER TABLE public.people_health_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage people_health_snapshots" ON public.people_health_snapshots
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));