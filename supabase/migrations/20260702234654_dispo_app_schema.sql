-- ============================================================
-- DISPO APP: prefixed schema to avoid collisions with existing
-- OpsHQ CRM tables (deals, contacts, etc). Team-shared (single
-- workspace) access model, matching the rest of OpsHQ.
-- ============================================================

CREATE TABLE public.dispo_deals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip TEXT NOT NULL DEFAULT '',
  asking_price NUMERIC,
  arv NUMERIC,
  repair_estimate NUMERIC,
  offer_price NUMERIC,
  beds INTEGER,
  baths NUMERIC,
  sqft INTEGER,
  year_built INTEGER,
  property_type TEXT DEFAULT 'single_family',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'pending', 'sold', 'dead')),
  description TEXT,
  notes TEXT,
  flyer_settings jsonb,
  email_content jsonb,
  social_settings jsonb,
  landing_settings jsonb,
  photo_url text,
  address_private boolean NOT NULL DEFAULT false,
  lot_size text,
  deal_type text,
  capital_needed numeric,
  projected_return text,
  investor_highlight text,
  investment_details text,
  sold_price numeric,
  sold_to_buyer_id uuid,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.dispo_deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team can view deals" ON public.dispo_deals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Team can create deals" ON public.dispo_deals FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Team can update deals" ON public.dispo_deals FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Team can delete deals" ON public.dispo_deals FOR DELETE TO authenticated USING (true);
CREATE POLICY "Public can view marketable deals" ON public.dispo_deals FOR SELECT TO anon USING (status IN ('active', 'pending', 'sold'));

CREATE TRIGGER update_dispo_deals_updated_at
  BEFORE UPDATE ON public.dispo_deals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO storage.buckets (id, name, public) VALUES ('dispo-property-photos', 'dispo-property-photos', true);
CREATE POLICY "Anyone can view dispo property photos" ON storage.objects FOR SELECT USING (bucket_id = 'dispo-property-photos');
CREATE POLICY "Authenticated users can upload dispo property photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'dispo-property-photos');
CREATE POLICY "Users can update dispo property photos" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'dispo-property-photos');
CREATE POLICY "Users can delete dispo property photos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'dispo-property-photos');

CREATE TABLE public.dispo_brand_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name text NOT NULL DEFAULT '',
  tagline text,
  primary_color text NOT NULL DEFAULT '#2563eb',
  secondary_color text,
  logo_url text,
  contact_name text,
  contact_phone text,
  contact_email text,
  default_style text,
  default_template text,
  brand_logos jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.dispo_brand_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team can view brand settings" ON public.dispo_brand_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Team can insert brand settings" ON public.dispo_brand_settings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Team can update brand settings" ON public.dispo_brand_settings FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Team can delete brand settings" ON public.dispo_brand_settings FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_dispo_brand_settings_updated_at
  BEFORE UPDATE ON public.dispo_brand_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.dispo_deal_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID NOT NULL REFERENCES public.dispo_deals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  asset_type TEXT NOT NULL,
  label TEXT,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  template_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.dispo_deal_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team can view assets" ON public.dispo_deal_assets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Team can insert assets" ON public.dispo_deal_assets FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Team can delete assets" ON public.dispo_deal_assets FOR DELETE TO authenticated USING (true);

CREATE INDEX idx_dispo_deal_assets_deal_type ON public.dispo_deal_assets(deal_id, asset_type);

CREATE TABLE public.dispo_buyers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ghl_contact_id text UNIQUE,
  first_name text NOT NULL DEFAULT '',
  last_name text NOT NULL DEFAULT '',
  email text,
  phone text,
  company text,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'ghl_sync', 'signup')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'unsubscribed', 'archived')),
  tier text CHECK (tier IN ('a', 'b', 'c')),
  email_opt_in boolean NOT NULL DEFAULT true,
  sms_opt_in boolean NOT NULL DEFAULT true,
  notes text,
  markets text[] NOT NULL DEFAULT '{}',
  states text[] NOT NULL DEFAULT '{}',
  zips text[] NOT NULL DEFAULT '{}',
  property_types text[] NOT NULL DEFAULT '{}',
  strategies text[] NOT NULL DEFAULT '{}',
  min_price numeric,
  max_price numeric,
  min_beds integer,
  min_baths numeric,
  min_sqft integer,
  financing text CHECK (financing IN ('cash', 'hard_money', 'private', 'conventional', 'creative')),
  proof_of_funds boolean NOT NULL DEFAULT false,
  buy_box_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dispo_buyers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team can view buyers" ON public.dispo_buyers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Team can insert buyers" ON public.dispo_buyers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Team can update buyers" ON public.dispo_buyers FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Team can delete buyers" ON public.dispo_buyers FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_dispo_buyers_updated_at
  BEFORE UPDATE ON public.dispo_buyers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_dispo_buyers_email ON public.dispo_buyers (lower(email));
CREATE INDEX idx_dispo_buyers_status ON public.dispo_buyers (status);

ALTER TABLE public.dispo_deals
  ADD CONSTRAINT dispo_deals_sold_to_buyer_fk FOREIGN KEY (sold_to_buyer_id)
  REFERENCES public.dispo_buyers(id) ON DELETE SET NULL;

CREATE TABLE public.dispo_deal_interests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.dispo_deals(id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL REFERENCES public.dispo_buyers(id) ON DELETE CASCADE,
  level text NOT NULL DEFAULT 'interested' CHECK (level IN ('interested', 'showing', 'offer', 'under_contract', 'passed')),
  offer_amount numeric,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'email_reply', 'sms_reply', 'landing_page', 'call')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (deal_id, buyer_id)
);

ALTER TABLE public.dispo_deal_interests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team can view interests" ON public.dispo_deal_interests FOR SELECT TO authenticated USING (true);
CREATE POLICY "Team can insert interests" ON public.dispo_deal_interests FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Team can update interests" ON public.dispo_deal_interests FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Team can delete interests" ON public.dispo_deal_interests FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_dispo_deal_interests_updated_at
  BEFORE UPDATE ON public.dispo_deal_interests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_dispo_deal_interests_deal ON public.dispo_deal_interests (deal_id);
CREATE INDEX idx_dispo_deal_interests_buyer ON public.dispo_deal_interests (buyer_id);

CREATE TABLE public.dispo_checklist_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  category text NOT NULL DEFAULT 'marketing',
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true
);

ALTER TABLE public.dispo_checklist_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team can view templates" ON public.dispo_checklist_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Team can insert templates" ON public.dispo_checklist_templates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Team can update templates" ON public.dispo_checklist_templates FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Team can delete templates" ON public.dispo_checklist_templates FOR DELETE TO authenticated USING (true);

INSERT INTO public.dispo_checklist_templates (label, category, sort_order) VALUES
  ('Photos & walkthrough video uploaded', 'prep', 10),
  ('Deal description & numbers finalized', 'prep', 20),
  ('Comps pulled & ARV verified', 'prep', 30),
  ('Flyer created', 'prep', 40),
  ('Landing page published', 'prep', 50),
  ('Email blast sent to buyers list', 'marketing', 60),
  ('SMS blast sent to VIP buyers', 'marketing', 70),
  ('Posted to Facebook groups', 'marketing', 80),
  ('Posted to Instagram / social', 'marketing', 90),
  ('Posted to marketplaces (InvestorLift, etc.)', 'marketing', 100),
  ('Top matched buyers called', 'marketing', 110),
  ('Showings scheduled', 'follow_up', 120),
  ('Follow-up sent to interested buyers', 'follow_up', 130),
  ('Highest & best deadline communicated', 'follow_up', 140);

CREATE TABLE public.dispo_deal_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.dispo_deals(id) ON DELETE CASCADE,
  label text NOT NULL,
  category text NOT NULL DEFAULT 'marketing',
  sort_order integer NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  completed_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dispo_deal_checklist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team can view checklist" ON public.dispo_deal_checklist_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Team can insert checklist" ON public.dispo_deal_checklist_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Team can update checklist" ON public.dispo_deal_checklist_items FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Team can delete checklist" ON public.dispo_deal_checklist_items FOR DELETE TO authenticated USING (true);

CREATE INDEX idx_dispo_deal_checklist_deal ON public.dispo_deal_checklist_items (deal_id);

CREATE TABLE public.dispo_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid REFERENCES public.dispo_deals(id) ON DELETE SET NULL,
  channel text NOT NULL CHECK (channel IN ('email', 'sms')),
  subject text,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sending', 'sent', 'failed')),
  audience text NOT NULL DEFAULT 'matched' CHECK (audience IN ('matched', 'all', 'tier_a', 'interested')),
  recipient_count integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE public.dispo_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team can view campaigns" ON public.dispo_campaigns FOR SELECT TO authenticated USING (true);
CREATE POLICY "Team can insert campaigns" ON public.dispo_campaigns FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Team can update campaigns" ON public.dispo_campaigns FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Team can delete campaigns" ON public.dispo_campaigns FOR DELETE TO authenticated USING (true);

CREATE TABLE public.dispo_campaign_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.dispo_campaigns(id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL REFERENCES public.dispo_buyers(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  error text,
  sent_at timestamptz,
  UNIQUE (campaign_id, buyer_id)
);

ALTER TABLE public.dispo_campaign_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team can view recipients" ON public.dispo_campaign_recipients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Team can insert recipients" ON public.dispo_campaign_recipients FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Team can update recipients" ON public.dispo_campaign_recipients FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Team can delete recipients" ON public.dispo_campaign_recipients FOR DELETE TO authenticated USING (true);

CREATE INDEX idx_dispo_campaign_recipients_campaign ON public.dispo_campaign_recipients (campaign_id);

CREATE OR REPLACE FUNCTION public.dispo_match_buyers_for_deal(deal_uuid uuid)
RETURNS TABLE (
  buyer_id uuid,
  score integer,
  reasons text[]
)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $$
DECLARE
  d public.dispo_deals%ROWTYPE;
BEGIN
  SELECT * INTO d FROM public.dispo_deals WHERE id = deal_uuid;
  IF NOT FOUND THEN RETURN; END IF;

  RETURN QUERY
  SELECT
    b.id,
    (
      CASE WHEN d.city IS NOT NULL AND EXISTS (SELECT 1 FROM unnest(b.markets) m WHERE lower(m) = lower(d.city)) THEN 3 ELSE 0 END
      + CASE WHEN d.zip <> '' AND d.zip = ANY(b.zips) THEN 3 ELSE 0 END
      + CASE WHEN d.state IS NOT NULL AND EXISTS (SELECT 1 FROM unnest(b.states) s WHERE lower(s) = lower(d.state)) THEN 1 ELSE 0 END
      + CASE WHEN d.property_type IS NOT NULL AND d.property_type = ANY(b.property_types) THEN 2 ELSE 0 END
      + CASE WHEN d.asking_price IS NOT NULL
              AND (b.min_price IS NULL OR d.asking_price >= b.min_price)
              AND (b.max_price IS NULL OR d.asking_price <= b.max_price)
              AND (b.min_price IS NOT NULL OR b.max_price IS NOT NULL) THEN 2 ELSE 0 END
      + CASE WHEN d.beds IS NOT NULL AND b.min_beds IS NOT NULL AND d.beds >= b.min_beds THEN 1 ELSE 0 END
      + CASE WHEN b.tier = 'a' THEN 1 ELSE 0 END
    )::integer AS score,
    ARRAY(
      SELECT r FROM (VALUES
        (CASE WHEN d.city IS NOT NULL AND EXISTS (SELECT 1 FROM unnest(b.markets) m WHERE lower(m) = lower(d.city)) THEN 'Market: ' || d.city END),
        (CASE WHEN d.zip <> '' AND d.zip = ANY(b.zips) THEN 'Zip: ' || d.zip END),
        (CASE WHEN d.property_type IS NOT NULL AND d.property_type = ANY(b.property_types) THEN 'Property type match' END),
        (CASE WHEN d.asking_price IS NOT NULL
              AND (b.min_price IS NULL OR d.asking_price >= b.min_price)
              AND (b.max_price IS NULL OR d.asking_price <= b.max_price)
              AND (b.min_price IS NOT NULL OR b.max_price IS NOT NULL) THEN 'In price range' END),
        (CASE WHEN d.beds IS NOT NULL AND b.min_beds IS NOT NULL AND d.beds >= b.min_beds THEN 'Meets bed count' END),
        (CASE WHEN b.tier = 'a' THEN 'A-tier buyer' END)
      ) AS t(r) WHERE r IS NOT NULL
    ) AS reasons
  FROM public.dispo_buyers b
  WHERE b.status = 'active'
  ORDER BY 2 DESC, b.created_at ASC;
END;
$$;;
