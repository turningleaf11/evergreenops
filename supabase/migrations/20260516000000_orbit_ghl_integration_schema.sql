-- Rename leads_qualified to conversations (per Autumn's clarification: qualified = appt set,
-- conversations = connected calls, which is the more useful metric)
ALTER TABLE public.orbit_performance_snapshots RENAME COLUMN leads_qualified TO conversations;

-- Link Orbit members to their GHL user account + track last sync time
ALTER TABLE public.orbit_members ADD COLUMN IF NOT EXISTS ghl_user_id TEXT;
ALTER TABLE public.orbit_members ADD COLUMN IF NOT EXISTS ghl_synced_at TIMESTAMPTZ;
