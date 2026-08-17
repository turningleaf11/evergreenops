-- The GHL identity link was stored on orbit_members, so it lived and died
-- with Orbit enrollment: graduate or remove someone and you lose which GHL
-- user they are, even though that's a fact about the person, not the
-- enrollment. Move it to profiles so it's set once, in Settings, and
-- survives program status changes. orbit_performance_snapshots stays keyed
-- to the Orbit member — that part genuinely is program-specific.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ghl_user_id TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ghl_synced_at TIMESTAMPTZ;

UPDATE public.profiles p
SET ghl_user_id = om.ghl_user_id,
    ghl_synced_at = om.ghl_synced_at
FROM public.orbit_members om
WHERE om.user_id = p.user_id
  AND om.ghl_user_id IS NOT NULL;

ALTER TABLE public.orbit_members DROP COLUMN IF EXISTS ghl_user_id;
ALTER TABLE public.orbit_members DROP COLUMN IF EXISTS ghl_synced_at;
