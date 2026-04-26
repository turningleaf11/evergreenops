-- 1. Add new columns
ALTER TABLE public.crm_custom_fields
  ADD COLUMN IF NOT EXISTS contact_type text,
  ADD COLUMN IF NOT EXISTS is_template boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_deletable boolean NOT NULL DEFAULT true;

-- 2. Expand field_type to include "tags"
ALTER TABLE public.crm_custom_fields
  DROP CONSTRAINT IF EXISTS crm_custom_fields_field_type_check;
ALTER TABLE public.crm_custom_fields
  ADD CONSTRAINT crm_custom_fields_field_type_check
  CHECK (field_type = ANY (ARRAY[
    'text','number','date','select','multi_select','checkbox','url','textarea','tags'
  ]));

-- 3. Replace unique constraint to be (workspace, entity, contact_type, field_key)
ALTER TABLE public.crm_custom_fields
  DROP CONSTRAINT IF EXISTS crm_custom_fields_workspace_id_entity_type_field_key_key;

CREATE UNIQUE INDEX IF NOT EXISTS crm_custom_fields_unique_per_type
  ON public.crm_custom_fields (
    workspace_id, entity_type, COALESCE(contact_type, ''), field_key
  );

-- 4. Tighten delete: admins still manage, but template fields with is_deletable=false can't be removed
DROP POLICY IF EXISTS "Admins manage custom fields" ON public.crm_custom_fields;

CREATE POLICY "Admins insert custom fields"
  ON public.crm_custom_fields FOR INSERT
  TO authenticated
  WITH CHECK (workspace_id = public.get_user_workspace_id() AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update custom fields"
  ON public.crm_custom_fields FOR UPDATE
  TO authenticated
  USING (workspace_id = public.get_user_workspace_id() AND public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (workspace_id = public.get_user_workspace_id() AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete deletable custom fields"
  ON public.crm_custom_fields FOR DELETE
  TO authenticated
  USING (
    workspace_id = public.get_user_workspace_id()
    AND public.has_role(auth.uid(), 'admin'::app_role)
    AND is_deletable = true
  );

-- 5. Seed template fields per contact type for every workspace that doesn't already have them
DO $$
DECLARE
  ws_id uuid;
  templates jsonb := jsonb_build_array(
    -- Wholesaler / Broker
    jsonb_build_object('contact_type','wholesaler','field_key','deal_types','label','Deal Types','field_type','multi_select','options',jsonb_build_array('SFR','MF 2-4','MF 5+','Commercial','Land'),'sort_order',0),
    jsonb_build_object('contact_type','wholesaler','field_key','deal_quality','label','Deal Quality','field_type','select','options',jsonb_build_array('Excellent','Good','Average','Poor'),'sort_order',1),
    jsonb_build_object('contact_type','wholesaler','field_key','reliability_notes','label','Reliability Notes','field_type','textarea','options',jsonb_build_array(),'sort_order',2),
    jsonb_build_object('contact_type','broker','field_key','deal_types','label','Deal Types','field_type','multi_select','options',jsonb_build_array('SFR','MF 2-4','MF 5+','Commercial','Land'),'sort_order',0),
    jsonb_build_object('contact_type','broker','field_key','deal_quality','label','Deal Quality','field_type','select','options',jsonb_build_array('Excellent','Good','Average','Poor'),'sort_order',1),
    jsonb_build_object('contact_type','broker','field_key','reliability_notes','label','Reliability Notes','field_type','textarea','options',jsonb_build_array(),'sort_order',2),
    -- Buyer
    jsonb_build_object('contact_type','buyer','field_key','property_types','label','Property Types','field_type','multi_select','options',jsonb_build_array('SFR','MF 2-4','MF 5+','Commercial','Land'),'sort_order',0),
    jsonb_build_object('contact_type','buyer','field_key','price_range_min','label','Price Range Min','field_type','number','options',jsonb_build_array(),'sort_order',1),
    jsonb_build_object('contact_type','buyer','field_key','price_range_max','label','Price Range Max','field_type','number','options',jsonb_build_array(),'sort_order',2),
    jsonb_build_object('contact_type','buyer','field_key','preferred_strategy','label','Preferred Strategy','field_type','multi_select','options',jsonb_build_array('Fix & Flip','Buy & Hold','Wholesale','BRRRR'),'sort_order',3),
    jsonb_build_object('contact_type','buyer','field_key','funding_type','label','Funding Type','field_type','select','options',jsonb_build_array('Cash','Hard Money','Conventional','Other'),'sort_order',4),
    jsonb_build_object('contact_type','buyer','field_key','proof_of_funds_on_file','label','Proof of Funds on File','field_type','checkbox','options',jsonb_build_array(),'sort_order',5),
    jsonb_build_object('contact_type','buyer','field_key','closing_speed','label','Closing Speed','field_type','select','options',jsonb_build_array('7 days','14 days','21 days','30+ days'),'sort_order',6),
    jsonb_build_object('contact_type','buyer','field_key','notes','label','Notes','field_type','textarea','options',jsonb_build_array(),'sort_order',7),
    -- Lender
    jsonb_build_object('contact_type','lender','field_key','loan_types','label','Loan Types','field_type','multi_select','options',jsonb_build_array('Hard Money','Bridge','DSCR','Construction','Conventional'),'sort_order',0),
    jsonb_build_object('contact_type','lender','field_key','deal_types','label','Deal Types','field_type','multi_select','options',jsonb_build_array('SFR','MF 2-4','MF 5+','Commercial','Land'),'sort_order',1),
    jsonb_build_object('contact_type','lender','field_key','min_loan_amount','label','Min Loan Amount','field_type','number','options',jsonb_build_array(),'sort_order',2),
    jsonb_build_object('contact_type','lender','field_key','max_loan_amount','label','Max Loan Amount','field_type','number','options',jsonb_build_array(),'sort_order',3),
    jsonb_build_object('contact_type','lender','field_key','typical_rate_range','label','Typical Rate Range','field_type','text','options',jsonb_build_array(),'sort_order',4),
    jsonb_build_object('contact_type','lender','field_key','points','label','Points','field_type','text','options',jsonb_build_array(),'sort_order',5),
    jsonb_build_object('contact_type','lender','field_key','handles_draws','label','Handles Draws','field_type','checkbox','options',jsonb_build_array(),'sort_order',6),
    jsonb_build_object('contact_type','lender','field_key','markets','label','Markets','field_type','tags','options',jsonb_build_array(),'sort_order',7),
    jsonb_build_object('contact_type','lender','field_key','working_notes','label','Working Notes','field_type','textarea','options',jsonb_build_array(),'sort_order',8),
    -- Title Agent / Attorney
    jsonb_build_object('contact_type','title_agent','field_key','states_licensed','label','States Licensed','field_type','tags','options',jsonb_build_array(),'sort_order',0),
    jsonb_build_object('contact_type','title_agent','field_key','handles_double_closes','label','Handles Double Closes','field_type','checkbox','options',jsonb_build_array(),'sort_order',1),
    jsonb_build_object('contact_type','title_agent','field_key','creative_friendly','label','Creative Friendly','field_type','checkbox','options',jsonb_build_array(),'sort_order',2),
    jsonb_build_object('contact_type','title_agent','field_key','average_closing_speed','label','Average Closing Speed','field_type','select','options',jsonb_build_array('3 days','5 days','7 days','10+ days'),'sort_order',3),
    jsonb_build_object('contact_type','title_agent','field_key','works_with_investors','label','Works with Investors','field_type','checkbox','options',jsonb_build_array(),'sort_order',4),
    jsonb_build_object('contact_type','title_agent','field_key','process_notes','label','Process Notes','field_type','textarea','options',jsonb_build_array(),'sort_order',5),
    jsonb_build_object('contact_type','attorney','field_key','states_licensed','label','States Licensed','field_type','tags','options',jsonb_build_array(),'sort_order',0),
    jsonb_build_object('contact_type','attorney','field_key','handles_double_closes','label','Handles Double Closes','field_type','checkbox','options',jsonb_build_array(),'sort_order',1),
    jsonb_build_object('contact_type','attorney','field_key','creative_friendly','label','Creative Friendly','field_type','checkbox','options',jsonb_build_array(),'sort_order',2),
    jsonb_build_object('contact_type','attorney','field_key','average_closing_speed','label','Average Closing Speed','field_type','select','options',jsonb_build_array('3 days','5 days','7 days','10+ days'),'sort_order',3),
    jsonb_build_object('contact_type','attorney','field_key','works_with_investors','label','Works with Investors','field_type','checkbox','options',jsonb_build_array(),'sort_order',4),
    jsonb_build_object('contact_type','attorney','field_key','process_notes','label','Process Notes','field_type','textarea','options',jsonb_build_array(),'sort_order',5)
  );
  t jsonb;
BEGIN
  FOR ws_id IN SELECT id FROM public.workspaces LOOP
    FOR t IN SELECT * FROM jsonb_array_elements(templates) LOOP
      INSERT INTO public.crm_custom_fields (
        workspace_id, entity_type, contact_type, field_key, label, field_type, options,
        required, sort_order, is_template, is_deletable
      ) VALUES (
        ws_id,
        'contact',
        t->>'contact_type',
        t->>'field_key',
        t->>'label',
        t->>'field_type',
        COALESCE(t->'options', '[]'::jsonb),
        false,
        (t->>'sort_order')::int,
        true,
        false
      )
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END $$;