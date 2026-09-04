-- KPI tracking: unblock DTB/DTW as valid Orbit tracks (scorecard/roster only —
-- full workbook content deferred, see orbit-types.ts TRACK_CONTENT placeholders)
-- and add auto-scaling weekly targets on scorecard_metrics so a per-person goal
-- (e.g. "10 new relationships each") tracks headcount instead of drifting stale
-- whenever someone joins/leaves a track.

-- ── 1. Allow dtb/dtw as Orbit tracks ────────────────────────────────────────
ALTER TABLE public.orbit_members DROP CONSTRAINT IF EXISTS orbit_members_track_check;
ALTER TABLE public.orbit_members
  ADD CONSTRAINT orbit_members_track_check
  CHECK (track IN ('dts','dta','dtb','dtw','closer','deal_scout','underwriting','d4'));

-- ── 2. Per-person target on scorecard_metrics ───────────────────────────────
ALTER TABLE public.scorecard_metrics ADD COLUMN per_person_target numeric;
COMMENT ON COLUMN public.scorecard_metrics.per_person_target IS
  'When set, weekly_target is auto-computed as per_person_target × active headcount '
  'on the Orbit track scorecard_metric_track(ghl_field_key) resolves to, recalculated '
  'by recalc_scorecard_targets(). NULL (default) means weekly_target is a manual, static number.';

-- Resolves a metric's ghl_field_key to the Orbit track it's scoped to, using the
-- same channel convention scorecard-ghl-sync and evergreen-team-hub's useHubData
-- already rely on (channel as a ":<channel>" suffix or "<channel>:" prefix).
CREATE OR REPLACE FUNCTION public.scorecard_metric_track(p_ghl_field_key text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_ghl_field_key ILIKE 'realtor:%'    OR p_ghl_field_key ILIKE '%:realtor'    THEN 'dta'
    WHEN p_ghl_field_key ILIKE 'broker:%'     OR p_ghl_field_key ILIKE '%:broker'     THEN 'dtb'
    WHEN p_ghl_field_key ILIKE 'wholesaler:%' OR p_ghl_field_key ILIKE '%:wholesaler' THEN 'dtw'
    WHEN p_ghl_field_key ILIKE 'seller:%'     OR p_ghl_field_key ILIKE '%:seller'     THEN 'dts'
    ELSE NULL
  END;
$$;

-- Recomputes weekly_target for every metric that opted into auto-scaling.
-- ghl_user_id IS NOT NULL excludes placeholder/test orbit_members rows (e.g.
-- "Test Orbit User") from headcount — real members get it populated on GHL sync.
CREATE OR REPLACE FUNCTION public.recalc_scorecard_targets()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.scorecard_metrics m
  SET weekly_target = m.per_person_target * COALESCE((
        SELECT count(*) FROM public.orbit_members om
        WHERE om.status = 'active'
          AND om.ghl_user_id IS NOT NULL
          AND om.track = public.scorecard_metric_track(m.ghl_field_key)
      ), 0)
  WHERE m.per_person_target IS NOT NULL
    AND public.scorecard_metric_track(m.ghl_field_key) IS NOT NULL;
END;
$$;

-- Roster changed → recalc every auto-scaled metric (a single membership change
-- can only ever affect one track, but the set-based UPDATE above is cheap
-- enough at this table size to just run it rather than work out which track).
CREATE OR REPLACE FUNCTION public.trigger_recalc_scorecard_targets()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.recalc_scorecard_targets();
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS orbit_members_recalc_scorecard_targets ON public.orbit_members;
CREATE TRIGGER orbit_members_recalc_scorecard_targets
  AFTER INSERT OR DELETE OR UPDATE OF track, status, ghl_user_id ON public.orbit_members
  FOR EACH STATEMENT EXECUTE FUNCTION public.trigger_recalc_scorecard_targets();

-- Metric row itself changed (target just turned on, or the GHL key/track it
-- resolves to changed) → recompute that row inline before the write commits.
CREATE OR REPLACE FUNCTION public.scorecard_metric_apply_per_person_target()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.per_person_target IS NOT NULL AND public.scorecard_metric_track(NEW.ghl_field_key) IS NOT NULL THEN
    NEW.weekly_target := NEW.per_person_target * COALESCE((
      SELECT count(*) FROM public.orbit_members om
      WHERE om.status = 'active'
        AND om.ghl_user_id IS NOT NULL
        AND om.track = public.scorecard_metric_track(NEW.ghl_field_key)
    ), 0);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS scorecard_metrics_apply_per_person_target ON public.scorecard_metrics;
CREATE TRIGGER scorecard_metrics_apply_per_person_target
  BEFORE INSERT OR UPDATE OF per_person_target, ghl_field_key ON public.scorecard_metrics
  FOR EACH ROW EXECUTE FUNCTION public.scorecard_metric_apply_per_person_target();

-- ── 3. Turn on auto-scaling for the four "How We Work" per-person KPIs ─────
-- 10 new relationships/week each for DTA/DTB/DTW, 3 appointments/week each for DTS.
UPDATE public.scorecard_metrics SET per_person_target = 10 WHERE ghl_field_key = 'realtor:stage:Qualified';
UPDATE public.scorecard_metrics SET per_person_target = 10 WHERE ghl_field_key = 'broker:stage:Good Fit Drip';
UPDATE public.scorecard_metrics SET per_person_target = 10 WHERE ghl_field_key = 'wholesaler:stage:Good Fit';
UPDATE public.scorecard_metrics SET per_person_target = 3  WHERE ghl_field_key = 'seller:stage:Appointment Set';

SELECT public.recalc_scorecard_targets();
;
