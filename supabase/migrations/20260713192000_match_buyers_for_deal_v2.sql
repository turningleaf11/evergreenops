-- Upgrade buyer matching to the full 6-dimension model and add normalize_state
-- so a deal's "AZ" joins a buyer's "Arizona".
--
-- Scoring: city +3 · county/metro +2 · type +2 · exit +2 · price-fit +2
--          · state +1 · A-tier +1

create or replace function public.normalize_state(raw text)
returns text language sql immutable as $$
  select coalesce(
    (select m.nm from (values
      ('al','Alabama'),('ak','Alaska'),('az','Arizona'),('ar','Arkansas'),
      ('ca','California'),('co','Colorado'),('ct','Connecticut'),('de','Delaware'),
      ('fl','Florida'),('ga','Georgia'),('hi','Hawaii'),('id','Idaho'),
      ('il','Illinois'),('in','Indiana'),('ia','Iowa'),('ks','Kansas'),
      ('ky','Kentucky'),('la','Louisiana'),('me','Maine'),('md','Maryland'),
      ('ma','Massachusetts'),('mi','Michigan'),('mn','Minnesota'),('ms','Mississippi'),
      ('mo','Missouri'),('mt','Montana'),('ne','Nebraska'),('nv','Nevada'),
      ('nh','New Hampshire'),('nj','New Jersey'),('nm','New Mexico'),('ny','New York'),
      ('nc','North Carolina'),('nd','North Dakota'),('oh','Ohio'),('ok','Oklahoma'),
      ('or','Oregon'),('pa','Pennsylvania'),('ri','Rhode Island'),('sc','South Carolina'),
      ('sd','South Dakota'),('tn','Tennessee'),('tx','Texas'),('ut','Utah'),
      ('vt','Vermont'),('va','Virginia'),('wa','Washington'),('wv','West Virginia'),
      ('wi','Wisconsin'),('wy','Wyoming'),('dc','District of Columbia'),
      ('nationwide','Nationwide'),('national','Nationwide'),('usa','Nationwide'),('us','Nationwide')
    ) as m(abbr, nm) where m.abbr = lower(trim(raw))),
    initcap(trim(raw))
  );
$$;

create or replace function public.match_buyers_for_deal(
  p_transaction_id uuid,
  p_min_score int default 1
)
returns table (
  buyer_id uuid, score int, reasons text[],
  first_name text, last_name text, company text, email text, phone text,
  tier text, max_price numeric, markets text[], states text[]
)
language sql stable
as $$
  with d as (
    select property_city, property_state, property_county_metro, property_type, best_exit,
           coalesce(purchase_price, asking_price) as price
    from crm_transactions where id = p_transaction_id
  ),
  flags as (
    select b.*,
      (d.property_city is not null and exists (
        select 1 from unnest(b.markets) m where lower(m) = lower(d.property_city))) as m_city,
      (d.property_county_metro is not null and exists (
        select 1 from unnest(b.county_metro) cm where lower(cm) = lower(d.property_county_metro))) as m_county,
      (d.property_state is not null and exists (
        select 1 from unnest(b.states) s where normalize_state(s) = normalize_state(d.property_state))) as m_state,
      (d.property_type is not null and b.property_types is not null and exists (
        select 1 from unnest(b.property_types) pt where lower(pt) = lower(d.property_type))) as m_type,
      (d.best_exit is not null and b.strategies is not null and exists (
        select 1 from unnest(b.strategies) st where lower(st) = lower(d.best_exit))) as m_exit,
      (d.price is not null and b.max_price is not null and d.price <= b.max_price
        and (b.min_price is null or d.price >= b.min_price)) as m_price,
      (upper(coalesce(b.tier, '')) = 'A') as m_tier
    from dispo_buyers b cross join d
  ),
  scored as (
    select f.*,
      (case when f.m_city then 3 else 0 end
        + case when f.m_county then 2 else 0 end
        + case when f.m_type then 2 else 0 end
        + case when f.m_exit then 2 else 0 end
        + case when f.m_price then 2 else 0 end
        + case when f.m_state then 1 else 0 end
        + case when f.m_tier then 1 else 0 end) as sc
    from flags f
  )
  select id as buyer_id, sc as score,
    array_remove(array[
      case when m_city then 'City' end,
      case when m_county then 'County/Metro' end,
      case when m_state then 'State' end,
      case when m_type then 'Type' end,
      case when m_exit then 'Exit' end,
      case when m_price then 'Price fit' end,
      case when m_tier then 'A-tier' end
    ], null) as reasons,
    first_name, last_name, company, email, phone, tier, max_price, markets, states
  from scored
  where sc >= p_min_score
  order by sc desc, tier nulls last, updated_at desc
$$;

grant execute on function public.match_buyers_for_deal(uuid, int) to authenticated;
grant execute on function public.normalize_state(text) to authenticated;
