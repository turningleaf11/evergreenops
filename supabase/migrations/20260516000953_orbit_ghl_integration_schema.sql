
-- Rename leads_qualified → conversations on the performance table
ALTER TABLE public.orbit_performance_snapshots RENAME COLUMN leads_qualified TO conversations;

-- Link Orbit members to their GHL user account
ALTER TABLE public.orbit_members ADD COLUMN IF NOT EXISTS ghl_user_id TEXT;
ALTER TABLE public.orbit_members ADD COLUMN IF NOT EXISTS ghl_synced_at TIMESTAMPTZ;
;
