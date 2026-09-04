
create table if not exists contact_review_batches (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'running',
  triggered_by text not null default 'cron',
  contacts_fetched int not null default 0,
  contacts_queued int not null default 0,
  contacts_skipped int not null default 0,
  error text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists contact_review_queue (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references contact_review_batches(id) on delete cascade,
  ghl_contact_id text not null,
  contact_name text,
  contact_type text not null,
  phone text,
  current_status_tag text not null,
  current_status_label text not null,
  suggested_status_tag text not null,
  suggested_status_label text not null,
  confidence numeric(3,2) not null,
  reasoning text not null,
  conversation_snippet jsonb not null default '[]',
  review_status text not null default 'pending',
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  applied_at timestamptz,
  apply_error text,
  created_at timestamptz not null default now()
);

create index if not exists idx_crq_review_status on contact_review_queue(review_status);
create index if not exists idx_crq_contact_type on contact_review_queue(contact_type);
create index if not exists idx_crq_ghl_contact_id on contact_review_queue(ghl_contact_id);
create index if not exists idx_crb_status on contact_review_batches(status);

alter table contact_review_batches enable row level security;
alter table contact_review_queue enable row level security;

create policy "Admins manage review batches" on contact_review_batches
  for all using (
    exists (select 1 from user_roles where user_id = auth.uid() and role = 'admin')
  );

create policy "Admins manage review queue" on contact_review_queue
  for all using (
    exists (select 1 from user_roles where user_id = auth.uid() and role = 'admin')
  );
;
