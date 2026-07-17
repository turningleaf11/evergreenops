-- Observability + retry cap for the lead processor (process-site-leads).
alter table public.dispo_site_leads
  add column if not exists processed_at timestamptz,
  add column if not exists attempts int not null default 0,
  add column if not exists error text;
