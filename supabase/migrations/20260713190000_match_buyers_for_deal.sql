-- match_buyers_for_deal — score dispo_buyers against a deal (crm_transactions)
-- by buy-box fit, so the deal's Buyers tab can suggest who to reach out to.
--
-- Scoring (mirrors the standalone dispo app, adapted to the fields OpsHQ has):
--   city +3 · zip +3 · type +2 · price-fit +2 · state +1 · A-tier +1
-- Beds are intentionally omitted — crm_transactions doesn't store them.
--
-- SECURITY INVOKER (default): runs as the caller, so RLS on dispo_buyers /
-- crm_transactions applies normally.

create or replace function public.match_buyers_for_deal(
  p_transaction_id uuid,
  p_min_score int default 1
)
returns table (
  buyer_id uuid,
  score int,
  reasons text[],
  first_name text,
  last_name text,
  company text,
  email text,
  phone text,
  tier text,
  max_price numeric,
  markets text[],
  states text[]
)
language sql
stable
as $$
  with d as (
    select
      property_city,
      property_state,
      property_zip,
      property_type,
      coalesce(purchase_price, asking_price) as price
    from crm_transactions
    where id = p_transaction_id
  ),
  flags as (
    select
      b.*,
      (d.property_city is not null and exists (
        select 1 from unnest(b.markets) m where lower(m) = lower(d.property_city)
      )) as m_city,
      (d.property_state is not null and exists (
        select 1 from unnest(b.states) s where lower(s) = lower(d.property_state)
      )) as m_state,
      (d.property_zip is not null and b.zips is not null and d.property_zip = any(b.zips)) as m_zip,
      (d.property_type is not null and b.property_types is not null and exists (
        select 1 from unnest(b.property_types) pt where lower(pt) = lower(d.property_type)
      )) as m_type,
      (d.price is not null and b.max_price is not null and d.price <= b.max_price
        and (b.min_price is null or d.price >= b.min_price)) as m_price,
      (upper(coalesce(b.tier, '')) = 'A') as m_tier
    from dispo_buyers b
    cross join d
  ),
  scored as (
    select
      f.*,
      (case when f.m_city then 3 else 0 end
        + case when f.m_zip then 3 else 0 end
        + case when f.m_type then 2 else 0 end
        + case when f.m_price then 2 else 0 end
        + case when f.m_state then 1 else 0 end
        + case when f.m_tier then 1 else 0 end) as sc
    from flags f
  )
  select
    id as buyer_id,
    sc as score,
    array_remove(array[
      case when m_city then 'City' end,
      case when m_zip then 'ZIP' end,
      case when m_state then 'State' end,
      case when m_type then 'Type' end,
      case when m_price then 'Price fit' end,
      case when m_tier then 'A-tier' end
    ], null) as reasons,
    first_name, last_name, company, email, phone, tier, max_price, markets, states
  from scored
  where sc >= p_min_score
  order by sc desc, tier nulls last, updated_at desc
$$;

grant execute on function public.match_buyers_for_deal(uuid, int) to authenticated;
