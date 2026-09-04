
create table if not exists public.call_guide_scripts (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.call_guide_app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.call_guide_property_questions (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.call_guide_scripts enable row level security;
alter table public.call_guide_app_settings enable row level security;
alter table public.call_guide_property_questions enable row level security;

-- Evergreen Call Guide has no Supabase Auth — access is gated by the app's own
-- shared password check, and the anon key is already public in the browser
-- bundle. These policies just let that anon key read/write its own isolated
-- tables; they don't touch or weaken any other opshq table's RLS.
create policy "call_guide_scripts anon rw" on public.call_guide_scripts
  for all to anon using (true) with check (true);

create policy "call_guide_app_settings anon rw" on public.call_guide_app_settings
  for all to anon using (true) with check (true);

create policy "call_guide_property_questions anon rw" on public.call_guide_property_questions
  for all to anon using (true) with check (true);
;
