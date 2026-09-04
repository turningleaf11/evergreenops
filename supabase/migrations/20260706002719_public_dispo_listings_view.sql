-- Public-safe listing view: only marketing-relevant fields, never
-- assignment_fee/estimated_net/actual_net/attorney/lender contacts etc.
CREATE VIEW public.public_dispo_listings AS
SELECT
  t.id,
  t.property_address, t.property_city, t.property_state, t.property_zip, t.property_type,
  t.asking_price, t.created_at,
  d.photo_url, d.description, d.beds, d.baths, d.sqft, d.year_built, d.arv,
  d.investor_highlight, d.investment_details, d.address_private, d.dispo_stage
FROM public.crm_transactions t
JOIN public.dispo_deal_details d ON d.transaction_id = t.id
WHERE t.disposition_strategy = 'assign'
  AND d.dispo_stage NOT IN ('closed_won', 'lost_dead', 'lost_expired');

GRANT SELECT ON public.public_dispo_listings TO anon, authenticated;;
