-- The previous migration guessed policy names for its DROP IF EXISTS and missed
-- every one of them, so the real "Team can insert/update/delete" (USING true,
-- no WITH CHECK) policies are still live alongside the new restrictive ones.
-- Permissive policies OR together, so the old ones were still winning — this
-- migration had zero actual effect until now. Dropping the real names.

DROP POLICY IF EXISTS "Team can insert brand settings" ON public.dispo_brand_settings;
DROP POLICY IF EXISTS "Team can update brand settings" ON public.dispo_brand_settings;
DROP POLICY IF EXISTS "Team can delete brand settings" ON public.dispo_brand_settings;

DROP POLICY IF EXISTS "Team can insert buyers" ON public.dispo_buyers;
DROP POLICY IF EXISTS "Team can update buyers" ON public.dispo_buyers;
DROP POLICY IF EXISTS "Team can delete buyers" ON public.dispo_buyers;

DROP POLICY IF EXISTS "Team can insert recipients" ON public.dispo_campaign_recipients;
DROP POLICY IF EXISTS "Team can update recipients" ON public.dispo_campaign_recipients;
DROP POLICY IF EXISTS "Team can delete recipients" ON public.dispo_campaign_recipients;

DROP POLICY IF EXISTS "Team can insert campaigns" ON public.dispo_campaigns;
DROP POLICY IF EXISTS "Team can update campaigns" ON public.dispo_campaigns;
DROP POLICY IF EXISTS "Team can delete campaigns" ON public.dispo_campaigns;

DROP POLICY IF EXISTS "Team can insert templates" ON public.dispo_checklist_templates;
DROP POLICY IF EXISTS "Team can update templates" ON public.dispo_checklist_templates;
DROP POLICY IF EXISTS "Team can delete templates" ON public.dispo_checklist_templates;

DROP POLICY IF EXISTS "Team can insert dispo details" ON public.dispo_deal_details;
DROP POLICY IF EXISTS "Team can update dispo details" ON public.dispo_deal_details;
DROP POLICY IF EXISTS "Team can delete dispo details" ON public.dispo_deal_details;

DROP POLICY IF EXISTS "Team can insert interests" ON public.dispo_deal_interests;
DROP POLICY IF EXISTS "Team can update interests" ON public.dispo_deal_interests;
DROP POLICY IF EXISTS "Team can delete interests" ON public.dispo_deal_interests;

DROP POLICY IF EXISTS "Team can insert managers" ON public.dispo_managers;
DROP POLICY IF EXISTS "Team can update managers" ON public.dispo_managers;
DROP POLICY IF EXISTS "Team can delete managers" ON public.dispo_managers;

DROP POLICY IF EXISTS "Team can insert templates" ON public.dispo_templates;
DROP POLICY IF EXISTS "Team can update templates" ON public.dispo_templates;
DROP POLICY IF EXISTS "Team can delete templates" ON public.dispo_templates;

DROP POLICY IF EXISTS buy_box_criteria_auth ON public.buy_box_criteria;
DROP POLICY IF EXISTS buy_box_exceptions_auth ON public.buy_box_exceptions;

DROP POLICY IF EXISTS "database_api_keys authenticated all" ON public.database_api_keys;;
