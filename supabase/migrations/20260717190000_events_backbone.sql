-- The event backbone. Everything worth knowing writes one row here; the Feed is
-- all rows, the Inbox is the needs_action + unresolved subset. Team-wide (any
-- authenticated user sees and resolves). External systems (Zapier) POST via the
-- event-ingest function.
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  severity text not null default 'info' check (severity in ('info','success','warning','error')),
  title text not null,
  body text,
  source text,
  entity_type text,
  entity_id uuid,
  entity_label text,
  actor text,
  needs_action boolean not null default false,
  read_at timestamptz,
  resolved_at timestamptz,
  resolved_by uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists events_feed_idx on public.events (created_at desc);
create index if not exists events_inbox_idx on public.events (created_at desc) where needs_action and resolved_at is null;

alter table public.events enable row level security;
create policy "Team can view events"   on public.events for select to authenticated using (true);
create policy "Team can insert events" on public.events for insert to authenticated with check (true);
create policy "Team can update events" on public.events for update to authenticated using (true);

-- Shared secret for external ingest (Zapier). Stored in app_settings so the
-- public event-ingest function can verify it without a function env secret.
insert into public.app_settings (key, value)
select 'EVENT_INGEST_SECRET', replace(gen_random_uuid()::text, '-', '')
where not exists (select 1 from public.app_settings where key = 'EVENT_INGEST_SECRET');
