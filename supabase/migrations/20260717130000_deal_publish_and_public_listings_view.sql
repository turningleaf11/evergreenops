-- Publishing: an explicit toggle controls whether a deal appears on the public
-- inventory site, and a clean slug drives its URL (/properties/<slug>).
alter table public.crm_transactions
  add column if not exists published boolean not null default false,
  add column if not exists published_at timestamptz,
  add column if not exists slug text;

create unique index if not exists crm_transactions_slug_key
  on public.crm_transactions (slug) where slug is not null;

-- The public read API for the site. Exposes ONLY published, non-terminal deals
-- and ONLY public-safe columns: no P&L, no buyer data, and the street address
-- is withheld when the deal is marked address_private. Public status is derived
-- from stage + financing type to match the site's existing vocabulary.
create or replace view public.public_listings as
select
  t.slug,
  t.marketing_title,
  t.property_city,
  t.property_state,
  t.property_county_metro,
  case when t.address_private then null else t.property_address end as street_address,
  t.address_private,
  t.property_type,
  t.best_exit,
  coalesce(t.asking_price, t.purchase_price) as price,
  (t.custom_fields->>'financing_type') as financing_type,
  case
    when t.stage in ('send_assignment','pending_signature','pending_emd','title_dd','clear_to_close')
      then 'Under Contract'
    when (t.custom_fields->>'financing_type') in ('Subject To','Seller Finance','Wrap','Novation')
      then 'Equitable Interest For Sale'
    else 'For Sale'
  end as public_status,
  d.photos,
  d.beds,
  d.baths,
  d.sqft,
  d.year_built,
  (d.marketing_copy->>'description_en') as description_en,
  (d.marketing_copy->>'description_es') as description_es,
  t.custom_fields as financing_details,
  t.published_at
from public.crm_transactions t
left join public.dispo_deal_details d on d.transaction_id = t.id
where t.published = true
  and t.slug is not null
  and t.stage not in ('closed_won','lost_dead');

-- The site reads this view with the anon key. The view is security-definer by
-- default (runs as owner), so it bypasses base-table RLS to serve exactly the
-- published, public-safe rows above -- and nothing else.
grant select on public.public_listings to anon, authenticated;
