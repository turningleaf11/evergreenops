-- Dispositions engine: every write path here runs through dispo-send-campaign,
-- dispo-ghl-sync-buyers, dispo-buyer-signup etc., all of which use the service
-- role client (adminClient() in _shared/ghl.ts) and therefore bypass RLS
-- entirely. Tightening these tables cannot break those functions.
--
-- Rollback per table: drop the _read/_write policies, recreate as
--   CREATE POLICY <name>_all ON <table> FOR ALL TO authenticated USING (true) WITH CHECK (true);

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'dispo_buyers', 'dispo_campaigns', 'dispo_campaign_recipients',
    'dispo_deal_interests', 'dispo_managers', 'dispo_templates',
    'dispo_checklist_templates', 'dispo_brand_settings'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_authenticated_all', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)',
      t || '_read', t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (has_role(auth.uid(), ''admin''::app_role) OR is_leader(auth.uid())) WITH CHECK (has_role(auth.uid(), ''admin''::app_role) OR is_leader(auth.uid()))',
      t || '_write', t
    );
  END LOOP;
END $$;

-- dispo_deal_details has 2 open-read policies (one is presumably a public
-- share-link view) plus the same open-write problem — split, keeping any
-- existing public/select policy untouched and only replacing the ALL one.
DROP POLICY IF EXISTS "dispo_deal_details_authenticated_all" ON public.dispo_deal_details;
CREATE POLICY dispo_deal_details_write ON public.dispo_deal_details
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR is_leader(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_leader(auth.uid()));

-- API keys: raw values are never stored (key_hash only), but any authenticated
-- user being able to INSERT a row here is a path to forging entries that the
-- list-api / list-form / list-webhook-* functions (verify_jwt:false, auth by
-- key lookup) would treat as legitimate. Key issuance belongs to whoever owns
-- the workspace, not to anyone with a login.
DROP POLICY IF EXISTS database_api_keys_all ON public.database_api_keys;
CREATE POLICY database_api_keys_owner_only ON public.database_api_keys
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR created_by = auth.uid())
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR created_by = auth.uid());;
