-- ============================================================
-- Unify dispo into crm_transactions; GHL sync support
-- ============================================================

-- 1. contacts: idempotency key for GHL contact upsert
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS ghl_contact_id text UNIQUE;

-- 2. crm_transactions: GHL link + disposition_strategy lifecycle
ALTER TABLE public.crm_transactions ADD COLUMN IF NOT EXISTS ghl_opportunity_id text UNIQUE;
ALTER TABLE public.crm_transactions ALTER COLUMN disposition_strategy SET DEFAULT 'decide';
UPDATE public.crm_transactions SET disposition_strategy = 'decide' WHERE disposition_strategy IS NULL;
ALTER TABLE public.crm_transactions DROP CONSTRAINT IF EXISTS crm_transactions_disposition_strategy_check;
ALTER TABLE public.crm_transactions ADD CONSTRAINT crm_transactions_disposition_strategy_check
  CHECK (disposition_strategy IN ('decide', 'assign', 'hold'));

-- 3. dispo_deal_details: 1:1 marketing extension of a transaction (assign path only)
CREATE TABLE public.dispo_deal_details (
  transaction_id uuid PRIMARY KEY REFERENCES public.crm_transactions(id) ON DELETE CASCADE,
  photo_url text,
  description text,
  beds integer,
  baths numeric,
  sqft integer,
  year_built integer,
  arv numeric,
  repair_estimate numeric,
  investor_highlight text,
  investment_details text,
  flyer_settings jsonb,
  email_content jsonb,
  social_settings jsonb,
  landing_settings jsonb,
  address_private boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dispo_deal_details ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team can view dispo details" ON public.dispo_deal_details FOR SELECT TO authenticated USING (true);
CREATE POLICY "Team can insert dispo details" ON public.dispo_deal_details FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Team can update dispo details" ON public.dispo_deal_details FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Team can delete dispo details" ON public.dispo_deal_details FOR DELETE TO authenticated USING (true);
CREATE POLICY "Public can view assigned dispo details" ON public.dispo_deal_details FOR SELECT TO anon USING (true);

CREATE TRIGGER update_dispo_deal_details_updated_at
  BEFORE UPDATE ON public.dispo_deal_details
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. transaction_documents: uploaded contract + AI extraction
CREATE TABLE public.transaction_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.crm_transactions(id) ON DELETE CASCADE,
  doc_type text NOT NULL DEFAULT 'purchase_agreement',
  file_url text NOT NULL,
  uploaded_by uuid,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  extracted_fields jsonb,
  extraction_status text NOT NULL DEFAULT 'pending' CHECK (extraction_status IN ('pending', 'extracted', 'confirmed', 'failed')),
  confirmed_at timestamptz,
  confirmed_by uuid
);

ALTER TABLE public.transaction_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team can view documents" ON public.transaction_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Team can insert documents" ON public.transaction_documents FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Team can update documents" ON public.transaction_documents FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Team can delete documents" ON public.transaction_documents FOR DELETE TO authenticated USING (true);

CREATE INDEX idx_transaction_documents_transaction ON public.transaction_documents (transaction_id);

INSERT INTO storage.buckets (id, name, public) VALUES ('transaction-documents', 'transaction-documents', false)
ON CONFLICT (id) DO NOTHING;
CREATE POLICY "Team can view transaction docs" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'transaction-documents');
CREATE POLICY "Team can upload transaction docs" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'transaction-documents');
CREATE POLICY "Team can delete transaction docs" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'transaction-documents');

-- 5. Fold marketing checklist into transaction_checklist_items
ALTER TABLE public.transaction_checklist_items ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'tc';

-- 6. Repoint dispo FKs from dispo_deals to crm_transactions
ALTER TABLE public.dispo_deal_interests DROP CONSTRAINT IF EXISTS dispo_deal_interests_deal_id_fkey;
ALTER TABLE public.dispo_deal_interests RENAME COLUMN deal_id TO transaction_id;
ALTER TABLE public.dispo_deal_interests ADD CONSTRAINT dispo_deal_interests_transaction_id_fkey
  FOREIGN KEY (transaction_id) REFERENCES public.crm_transactions(id) ON DELETE CASCADE;

ALTER TABLE public.dispo_campaigns DROP CONSTRAINT IF EXISTS dispo_campaigns_deal_id_fkey;
ALTER TABLE public.dispo_campaigns RENAME COLUMN deal_id TO transaction_id;
ALTER TABLE public.dispo_campaigns ADD CONSTRAINT dispo_campaigns_transaction_id_fkey
  FOREIGN KEY (transaction_id) REFERENCES public.crm_transactions(id) ON DELETE SET NULL;

-- 7. Drop redundant tables now folded elsewhere
DROP TABLE IF EXISTS public.dispo_deal_checklist_items;
DROP TABLE IF EXISTS public.dispo_deals CASCADE;

-- 8. Update the buyer-matching RPC to read from crm_transactions + dispo_deal_details
DROP FUNCTION IF EXISTS public.dispo_match_buyers_for_deal(uuid);
CREATE OR REPLACE FUNCTION public.dispo_match_buyers_for_transaction(transaction_uuid uuid)
RETURNS TABLE (
  buyer_id uuid,
  score integer,
  reasons text[]
)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $$
DECLARE
  t public.crm_transactions%ROWTYPE;
  d public.dispo_deal_details%ROWTYPE;
BEGIN
  SELECT * INTO t FROM public.crm_transactions WHERE id = transaction_uuid;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT * INTO d FROM public.dispo_deal_details WHERE transaction_id = transaction_uuid;

  RETURN QUERY
  SELECT
    b.id,
    (
      CASE WHEN t.property_city IS NOT NULL AND EXISTS (SELECT 1 FROM unnest(b.markets) m WHERE lower(m) = lower(t.property_city)) THEN 3 ELSE 0 END
      + CASE WHEN t.property_zip IS NOT NULL AND t.property_zip = ANY(b.zips) THEN 3 ELSE 0 END
      + CASE WHEN t.property_state IS NOT NULL AND EXISTS (SELECT 1 FROM unnest(b.states) s WHERE lower(s) = lower(t.property_state)) THEN 1 ELSE 0 END
      + CASE WHEN t.property_type IS NOT NULL AND t.property_type = ANY(b.property_types) THEN 2 ELSE 0 END
      + CASE WHEN t.purchase_price IS NOT NULL
              AND (b.min_price IS NULL OR t.purchase_price >= b.min_price)
              AND (b.max_price IS NULL OR t.purchase_price <= b.max_price)
              AND (b.min_price IS NOT NULL OR b.max_price IS NOT NULL) THEN 2 ELSE 0 END
      + CASE WHEN d.beds IS NOT NULL AND b.min_beds IS NOT NULL AND d.beds >= b.min_beds THEN 1 ELSE 0 END
      + CASE WHEN b.tier = 'a' THEN 1 ELSE 0 END
    )::integer AS score,
    ARRAY(
      SELECT r FROM (VALUES
        (CASE WHEN t.property_city IS NOT NULL AND EXISTS (SELECT 1 FROM unnest(b.markets) m WHERE lower(m) = lower(t.property_city)) THEN 'Market: ' || t.property_city END),
        (CASE WHEN t.property_zip IS NOT NULL AND t.property_zip = ANY(b.zips) THEN 'Zip: ' || t.property_zip END),
        (CASE WHEN t.property_type IS NOT NULL AND t.property_type = ANY(b.property_types) THEN 'Property type match' END),
        (CASE WHEN t.purchase_price IS NOT NULL
              AND (b.min_price IS NULL OR t.purchase_price >= b.min_price)
              AND (b.max_price IS NULL OR t.purchase_price <= b.max_price)
              AND (b.min_price IS NOT NULL OR b.max_price IS NOT NULL) THEN 'In price range' END),
        (CASE WHEN d.beds IS NOT NULL AND b.min_beds IS NOT NULL AND d.beds >= b.min_beds THEN 'Meets bed count' END),
        (CASE WHEN b.tier = 'a' THEN 'A-tier buyer' END)
      ) AS t2(r) WHERE r IS NOT NULL
    ) AS reasons
  FROM public.dispo_buyers b
  WHERE b.status = 'active'
  ORDER BY 2 DESC, b.created_at ASC;
END;
$$;;
