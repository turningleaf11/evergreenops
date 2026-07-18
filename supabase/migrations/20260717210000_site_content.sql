-- Editable marketing copy for the public site (evergreen-dispo-site). Single row;
-- the site reads it with the anon key, OpsHQ's Site Content editor writes it.
-- Same pattern as site_branding.
create table if not exists public.site_content (
  id int primary key default 1,
  content jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint site_content_singleton check (id = 1)
);
insert into public.site_content (id, content) values (1, '{}'::jsonb) on conflict (id) do nothing;

alter table public.site_content enable row level security;
create policy "Anyone can read content" on public.site_content for select to anon, authenticated using (true);
create policy "Team can update content" on public.site_content for update to authenticated using (true) with check (true);
grant select on public.site_content to anon, authenticated;
grant update on public.site_content to authenticated;
