-- Add 'closer' as a valid Orbit track. The original check constraint had only
-- dts / dta / deal_scout / underwriting / d4.
ALTER TABLE public.orbit_members DROP CONSTRAINT IF EXISTS orbit_members_track_check;
ALTER TABLE public.orbit_members
  ADD CONSTRAINT orbit_members_track_check
  CHECK (track IN ('dts','dta','closer','deal_scout','underwriting','d4'));
