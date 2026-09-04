-- The team hub exposes these tables to everyone with a login, including Orbit
-- Deal Finders. They were ALL / USING (true) for `authenticated`, meaning anyone
-- signed in could WRITE them — so a finder could edit the scorecard numbers they
-- are judged on, and the leaderboard would be meaningless.
--
-- Reads stay open to any authenticated user; writes go to admins and leaders.
-- Roles: has_role(uid,'admin') reads user_roles; is_leader(uid) reads
-- profiles.is_leader.
--
-- Rollback: drop the policies added here and recreate the originals as
--   CREATE POLICY <name> ON <table> FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── scorecard_metrics — the weekly targets ─────────────────────────────────
DROP POLICY IF EXISTS scorecard_metrics_all ON public.scorecard_metrics;

CREATE POLICY scorecard_metrics_read ON public.scorecard_metrics
  FOR SELECT TO authenticated USING (true);

CREATE POLICY scorecard_metrics_write ON public.scorecard_metrics
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR is_leader(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_leader(auth.uid()));

-- ── scorecard_entries — the weekly actuals ─────────────────────────────────
DROP POLICY IF EXISTS scorecard_entries_all ON public.scorecard_entries;

CREATE POLICY scorecard_entries_read ON public.scorecard_entries
  FOR SELECT TO authenticated USING (true);

CREATE POLICY scorecard_entries_write ON public.scorecard_entries
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR is_leader(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_leader(auth.uid()));

-- ── underwriting_runs — the record of every underwrite ─────────────────────
-- INSERT stays open to authenticated because agents (Cash) write here and their
-- auth method isn't settled yet; blocking it would break the fleet the moment it
-- starts. UPDATE/DELETE are admin-only, so history can be added to but not
-- rewritten — the tampering that would actually corrupt the leaderboard.
DROP POLICY IF EXISTS underwriting_runs_auth ON public.underwriting_runs;

CREATE POLICY underwriting_runs_read ON public.underwriting_runs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY underwriting_runs_insert ON public.underwriting_runs
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY underwriting_runs_update ON public.underwriting_runs
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY underwriting_runs_delete ON public.underwriting_runs
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ── announcements ──────────────────────────────────────────────────────────
-- The permissive policy sat alongside an admin-only one; permissive policies are
-- OR'd, so the loose one won and the admin policy did nothing.
DROP POLICY IF EXISTS "announcements authenticated all" ON public.announcements;

CREATE POLICY announcements_write ON public.announcements
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR is_leader(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_leader(auth.uid()));;
