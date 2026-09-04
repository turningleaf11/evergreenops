-- ============================================================================
-- AUDIT FIX — bring 4 tables in line with the TypeScript types the frontend
-- expects. Generated from a full diff of information_schema.columns vs
-- src/integrations/supabase/types.ts.
-- ============================================================================

-- ──────────────────────────────────────────────────────────────────────────
-- 1) crm_transactions — full schema rebuild. The live DB had the old
--    simpler version (buyer_name/seller_name/close_date/contract_price/title/
--    title_company/files). The frontend expects the rich CRM version with
--    27 additional columns. Table is empty (verified) so we drop the old
--    columns and add the new ones cleanly.
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE public.crm_transactions DROP COLUMN IF EXISTS buyer_name;
ALTER TABLE public.crm_transactions DROP COLUMN IF EXISTS seller_name;
ALTER TABLE public.crm_transactions DROP COLUMN IF EXISTS close_date;
ALTER TABLE public.crm_transactions DROP COLUMN IF EXISTS contract_price;
ALTER TABLE public.crm_transactions DROP COLUMN IF EXISTS title;
ALTER TABLE public.crm_transactions DROP COLUMN IF EXISTS title_company;
ALTER TABLE public.crm_transactions DROP COLUMN IF EXISTS files;

ALTER TABLE public.crm_transactions ADD COLUMN IF NOT EXISTS actual_net                  numeric;
ALTER TABLE public.crm_transactions ADD COLUMN IF NOT EXISTS asking_price                numeric;
ALTER TABLE public.crm_transactions ADD COLUMN IF NOT EXISTS assignment_fee              numeric;
ALTER TABLE public.crm_transactions ADD COLUMN IF NOT EXISTS attorney_contact_id         uuid REFERENCES public.contacts(id) ON DELETE SET NULL;
ALTER TABLE public.crm_transactions ADD COLUMN IF NOT EXISTS buyer_contact_id            uuid REFERENCES public.contacts(id) ON DELETE SET NULL;
ALTER TABLE public.crm_transactions ADD COLUMN IF NOT EXISTS closing_date                date;
ALTER TABLE public.crm_transactions ADD COLUMN IF NOT EXISTS disposition_strategy        text;
ALTER TABLE public.crm_transactions ADD COLUMN IF NOT EXISTS due_diligence_end           date;
ALTER TABLE public.crm_transactions ADD COLUMN IF NOT EXISTS earnest_money_received      boolean NOT NULL DEFAULT false;
ALTER TABLE public.crm_transactions ADD COLUMN IF NOT EXISTS earnest_money_received_date date;
ALTER TABLE public.crm_transactions ADD COLUMN IF NOT EXISTS earnest_money_required      numeric;
ALTER TABLE public.crm_transactions ADD COLUMN IF NOT EXISTS estimated_net               numeric;
ALTER TABLE public.crm_transactions ADD COLUMN IF NOT EXISTS inspection_deadline         date;
ALTER TABLE public.crm_transactions ADD COLUMN IF NOT EXISTS lane                        text NOT NULL DEFAULT 'wholesale';
ALTER TABLE public.crm_transactions ADD COLUMN IF NOT EXISTS lender_contact_id           uuid REFERENCES public.contacts(id) ON DELETE SET NULL;
ALTER TABLE public.crm_transactions ADD COLUMN IF NOT EXISTS owner_id                    uuid;
ALTER TABLE public.crm_transactions ADD COLUMN IF NOT EXISTS primary_contact_id          uuid REFERENCES public.contacts(id) ON DELETE SET NULL;
ALTER TABLE public.crm_transactions ADD COLUMN IF NOT EXISTS property_city               text;
ALTER TABLE public.crm_transactions ADD COLUMN IF NOT EXISTS property_state              text;
ALTER TABLE public.crm_transactions ADD COLUMN IF NOT EXISTS property_type               text;
ALTER TABLE public.crm_transactions ADD COLUMN IF NOT EXISTS property_zip                text;
ALTER TABLE public.crm_transactions ADD COLUMN IF NOT EXISTS purchase_price              numeric;
ALTER TABLE public.crm_transactions ADD COLUMN IF NOT EXISTS source_contact_id           uuid REFERENCES public.contacts(id) ON DELETE SET NULL;
ALTER TABLE public.crm_transactions ADD COLUMN IF NOT EXISTS title_contact_id            uuid REFERENCES public.contacts(id) ON DELETE SET NULL;
ALTER TABLE public.crm_transactions ADD COLUMN IF NOT EXISTS transaction_type            text NOT NULL DEFAULT 'assign';
ALTER TABLE public.crm_transactions ADD COLUMN IF NOT EXISTS unit_mix                    text;
ALTER TABLE public.crm_transactions ADD COLUMN IF NOT EXISTS units                       integer;

CREATE INDEX IF NOT EXISTS idx_crm_transactions_owner          ON public.crm_transactions(owner_id);
CREATE INDEX IF NOT EXISTS idx_crm_transactions_lane           ON public.crm_transactions(lane);
CREATE INDEX IF NOT EXISTS idx_crm_transactions_closing_date   ON public.crm_transactions(closing_date);

-- ──────────────────────────────────────────────────────────────────────────
-- 2) contacts — add the 5 missing columns
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS contact_type             text;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS is_active                boolean NOT NULL DEFAULT true;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS markets                  text[];
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS buy_box_notes            text;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS preferred_contact_method text;

CREATE INDEX IF NOT EXISTS idx_contacts_contact_type ON public.contacts(contact_type);
CREATE INDEX IF NOT EXISTS idx_contacts_is_active    ON public.contacts(is_active);

-- ──────────────────────────────────────────────────────────────────────────
-- 3) crm_custom_fields — add the 3 missing template/categorization columns
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE public.crm_custom_fields ADD COLUMN IF NOT EXISTS contact_type  text;
ALTER TABLE public.crm_custom_fields ADD COLUMN IF NOT EXISTS is_deletable  boolean NOT NULL DEFAULT true;
ALTER TABLE public.crm_custom_fields ADD COLUMN IF NOT EXISTS is_template   boolean NOT NULL DEFAULT false;

-- ──────────────────────────────────────────────────────────────────────────
-- 4) profiles — add 3 enhancement columns (timezone, availability, skills)
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS availability_status text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS skills              text[];
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS timezone            text;;
