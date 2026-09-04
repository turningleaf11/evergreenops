-- 1. closer track on orbit_members.track
ALTER TABLE public.orbit_members DROP CONSTRAINT IF EXISTS orbit_members_track_check;
ALTER TABLE public.orbit_members
  ADD CONSTRAINT orbit_members_track_check
  CHECK (track IN ('dts','dta','closer','deal_scout','underwriting','d4'));

-- 2. profiles.is_orbit_only
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_orbit_only BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS profiles_is_orbit_only_idx ON public.profiles(is_orbit_only) WHERE is_orbit_only = true;

-- 3. orbit_track_content overrides
CREATE TABLE IF NOT EXISTS public.orbit_track_content (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID,
  track TEXT NOT NULL,
  full_name TEXT,
  tagline TEXT,
  what_it_is TEXT,
  kpis JSONB,
  daily_flow JSONB,
  success_criteria JSONB,
  getting_started JSONB,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, track),
  CONSTRAINT orbit_track_content_track_check
    CHECK (track IN ('dts','dta','closer','deal_scout','underwriting','d4'))
);
CREATE INDEX IF NOT EXISTS orbit_track_content_ws_track_idx
  ON public.orbit_track_content(workspace_id, track);
ALTER TABLE public.orbit_track_content ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "orbit_track_content_select" ON public.orbit_track_content;
CREATE POLICY "orbit_track_content_select" ON public.orbit_track_content FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "orbit_track_content_admin" ON public.orbit_track_content;
CREATE POLICY "orbit_track_content_admin" ON public.orbit_track_content FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
DROP TRIGGER IF EXISTS orbit_track_content_set_updated ON public.orbit_track_content;
CREATE TRIGGER orbit_track_content_set_updated BEFORE UPDATE ON public.orbit_track_content FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();;
