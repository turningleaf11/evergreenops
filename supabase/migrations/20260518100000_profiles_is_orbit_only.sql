-- Orbit-only flag — when true, the user is a sales-only Orbit Program member
-- with restricted UI access (Home / Feed / People / Training / Orbit Program).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_orbit_only BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS profiles_is_orbit_only_idx ON public.profiles(is_orbit_only) WHERE is_orbit_only = true;
