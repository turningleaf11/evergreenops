create table if not exists public.evergreen_site_leads (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('broker','investor','wholesaler','other')),
  first_name text,
  last_name text,
  email text,
  phone text,
  message text,
  source_page text,
  processed boolean not null default false,
  processed_at timestamptz,
  attempts integer not null default 0,
  error text,
  created_at timestamptz not null default now()
);

alter table public.evergreen_site_leads enable row level security;

create policy "evergreen_site_leads_public_insert"
  on public.evergreen_site_leads
  for insert
  to anon, authenticated
  with check (true);;
