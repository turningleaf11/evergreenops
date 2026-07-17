-- Comps / neighborhood context for the listing (marketing content).
alter table public.dispo_deal_details add column if not exists comps text;

-- Dispo manager profiles: the point of contact shown on a listing. A deal picks
-- one; the site shows their photo + contact. Starts with one, grows over time.
create table if not exists public.dispo_managers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  title text,
  email text,
  phone text,
  photo_url text,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.dispo_managers enable row level security;
create policy "Team can view managers"   on public.dispo_managers for select to authenticated using (true);
create policy "Team can insert managers" on public.dispo_managers for insert to authenticated with check (true);
create policy "Team can update managers" on public.dispo_managers for update to authenticated using (true);
create policy "Team can delete managers" on public.dispo_managers for delete to authenticated using (true);

insert into public.dispo_managers (name, title, email, phone, sort_order)
select 'Diego Arboleda', 'Dispositions Manager', 'diego@evergreenreventures.com', '561-257-2948', 1
where not exists (select 1 from public.dispo_managers);

-- Which manager fronts this deal on the site.
alter table public.crm_transactions
  add column if not exists dispo_manager_id uuid references public.dispo_managers(id) on delete set null;

-- Rebuild the public read API with comps + the assigned manager's public info.
drop view if exists public.public_listings;
create view public.public_listings as
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
  d.comps,
  t.custom_fields as financing_details,
  m.name  as manager_name,
  m.title as manager_title,
  m.email as manager_email,
  m.phone as manager_phone,
  m.photo_url as manager_photo_url,
  t.published_at
from public.crm_transactions t
left join public.dispo_deal_details d on d.transaction_id = t.id
left join public.dispo_managers m on m.id = t.dispo_manager_id
where t.published = true
  and t.slug is not null
  and t.stage not in ('closed_won','lost_dead');

grant select on public.public_listings to anon, authenticated;
