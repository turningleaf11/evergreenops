DROP POLICY IF EXISTS "Members can see own checklist" ON public.orbit_setup_checklist;
CREATE POLICY "Members can see own checklist"
ON public.orbit_setup_checklist FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.orbit_members om
   WHERE om.id = orbit_setup_checklist.member_id AND om.user_id = auth.uid()
));
