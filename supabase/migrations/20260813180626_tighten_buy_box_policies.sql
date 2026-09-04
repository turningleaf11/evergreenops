-- buy_box_criteria / buy_box_exceptions were ALL / USING (true) for authenticated —
-- any logged-in user could edit the screening rules Cash and the whole team rely
-- on. Nothing in the app writes to these except admin tooling, so this is a clean
-- tighten with no known dependency to break.
--
-- Rollback: drop these policies, recreate as
--   CREATE POLICY <name> ON <table> FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS buy_box_criteria_all ON public.buy_box_criteria;
CREATE POLICY buy_box_criteria_read ON public.buy_box_criteria
  FOR SELECT TO authenticated USING (true);
CREATE POLICY buy_box_criteria_write ON public.buy_box_criteria
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR is_leader(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_leader(auth.uid()));

DROP POLICY IF EXISTS buy_box_exceptions_all ON public.buy_box_exceptions;
CREATE POLICY buy_box_exceptions_read ON public.buy_box_exceptions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY buy_box_exceptions_write ON public.buy_box_exceptions
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR is_leader(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_leader(auth.uid()));;
