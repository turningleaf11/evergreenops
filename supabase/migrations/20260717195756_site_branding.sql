-- Editable branding for the public site: colors (hex) + font choices. Single
-- row. The site reads it with the anon key; OpsHQ's Site Branding editor writes.
create table if not exists public.site_branding (
  id int primary key default 1,
  colors jsonb not null,
  font_display text not null default 'Fraunces',
  font_body text not null default 'Inter',
  updated_at timestamptz not null default now(),
  constraint site_branding_singleton check (id = 1)
);

insert into public.site_branding (id, colors, font_display, font_body)
values (1, jsonb_build_object(
  'paper','#F9F8F6', 'paper_deep','#EFEDE8', 'ink','#01041B', 'night','#01041B',
  'forest','#288A6D', 'forest_deep','#1F6E56', 'forest_mid','#1C9E6F',
  'sage','#8FB5A6', 'sage_light','#AED2C5', 'line','#E6E3DC'
), 'Fraunces', 'Inter')
on conflict (id) do nothing;

alter table public.site_branding enable row level security;
create policy "Anyone can read branding" on public.site_branding for select to anon, authenticated using (true);
create policy "Team can update branding" on public.site_branding for update to authenticated using (true) with check (true);
grant select on public.site_branding to anon, authenticated;
grant update on public.site_branding to authenticated;;
