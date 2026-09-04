alter table public.notes
  add column if not exists full_width boolean not null default false;;
