-- profiles gets the link
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ghl_user_id TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ghl_synced_at TIMESTAMPTZ;

UPDATE public.profiles p
SET ghl_user_id = om.ghl_user_id,
    ghl_synced_at = om.ghl_synced_at
FROM public.orbit_members om
WHERE om.user_id = p.user_id
  AND om.ghl_user_id IS NOT NULL;

-- orbit_call_events RLS depended on orbit_members.ghl_user_id; repoint at profiles
DROP POLICY IF EXISTS "Members see own call events" ON public.orbit_call_events;
CREATE POLICY "Members see own call events" ON public.orbit_call_events
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.ghl_user_id = orbit_call_events.ghl_user_id AND p.user_id = auth.uid()
  ));

-- scorecard-target recalc trigger watched ghl_user_id on orbit_members; drop that column from its watch list
DROP TRIGGER IF EXISTS orbit_members_recalc_scorecard_targets ON public.orbit_members;
CREATE TRIGGER orbit_members_recalc_scorecard_targets
  AFTER INSERT OR DELETE OR UPDATE OF track, status ON public.orbit_members
  FOR EACH STATEMENT EXECUTE FUNCTION trigger_recalc_scorecard_targets();

ALTER TABLE public.orbit_members DROP COLUMN IF EXISTS ghl_user_id;
ALTER TABLE public.orbit_members DROP COLUMN IF EXISTS ghl_synced_at;;
