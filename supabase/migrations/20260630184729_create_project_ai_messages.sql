
create table if not exists project_ai_messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null default '',
  proposed_tasks jsonb,
  tasks_created boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists project_ai_messages_project_created
  on project_ai_messages(project_id, created_at);

alter table project_ai_messages enable row level security;

create policy "authenticated users can read ai messages"
  on project_ai_messages for select
  using (auth.uid() is not null);

create policy "authenticated users can insert ai messages"
  on project_ai_messages for insert
  with check (auth.uid() is not null);

create policy "authenticated users can update ai messages"
  on project_ai_messages for update
  using (auth.uid() is not null);
;
