-- Onboarding flags on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_skipped boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS onboarding_progress jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Pending team members captured during onboarding
CREATE TABLE IF NOT EXISTS public.pending_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid,
  created_by uuid NOT NULL,
  name text NOT NULL,
  role text DEFAULT '',
  email text,
  notes text DEFAULT '',
  invited boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pending_team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage pending team members"
  ON public.pending_team_members
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Creators manage their pending team members"
  ON public.pending_team_members
  FOR ALL
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);