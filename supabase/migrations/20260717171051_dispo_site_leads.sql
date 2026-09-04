-- Leads captured by the public inventory site: property inquiries (with optional
-- offer) and VIP buyers-list opt-ins (with buy-box). The site writes here via
-- the service role in a server action. Phase 3 pushes unprocessed rows to GHL
-- and attributes inquiries to the deal's interest tracker.
create table if not exists public.dispo_site_leads (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('inquiry','buyers_list')),
  deal_slug text,
  first_name text,
  last_name text,
  email text,
  phone text,
  offer_price numeric,
  message text,
  buy_box jsonb,
  processed boolean not null default false,
  created_at timestamptz not null default now()
);

-- RLS on, no anon policies: only the service role (the site's server action)
-- writes. Operator read access is added alongside the OpsHQ inbox in Phase 3.
alter table public.dispo_site_leads enable row level security;

create index if not exists dispo_site_leads_unprocessed_idx
  on public.dispo_site_leads (created_at desc) where not processed;;
