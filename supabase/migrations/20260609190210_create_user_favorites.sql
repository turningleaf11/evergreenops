
create table if not exists public.user_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  url text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.user_favorites enable row level security;

create policy "Users can manage their own favorites"
  on public.user_favorites
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
;
