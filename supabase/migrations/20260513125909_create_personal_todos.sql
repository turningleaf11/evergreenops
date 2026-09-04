
create table if not exists personal_todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  is_complete boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

alter table personal_todos enable row level security;

create policy "Users manage own todos" on personal_todos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
;
