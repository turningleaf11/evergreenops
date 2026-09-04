
create schema if not exists deal_analyzer;

create table deal_analyzer.deals (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Untitled Deal',
  status text not null default 'analyzing' check (status in ('analyzing','reviewing','under-contract','passed','closed')),
  notes text not null default '',
  analyzer_inputs jsonb not null default '{}'::jsonb,
  analyzer_results jsonb not null default '{}'::jsonb,
  offer_inputs jsonb not null default '{}'::jsonb,
  offer_results jsonb not null default '{}'::jsonb,
  capital_stack_inputs jsonb not null default '{}'::jsonb,
  capital_stack_results jsonb not null default '{}'::jsonb,
  returns_inputs jsonb not null default '{}'::jsonb,
  returns_results jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table deal_analyzer.documents (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references deal_analyzer.deals(id) on delete cascade,
  file_name text not null,
  file_type text not null,
  size_bytes bigint not null default 0,
  storage_path text not null,
  extraction_status text not null default 'pending' check (extraction_status in ('pending','processing','completed','failed')),
  extracted_data jsonb,
  extraction_error text,
  applied boolean not null default false,
  created_at timestamptz not null default now()
);

create index documents_deal_id_idx on deal_analyzer.documents(deal_id);

alter table deal_analyzer.deals enable row level security;
alter table deal_analyzer.documents enable row level security;

-- No anon/authenticated policies: this app has no auth layer yet, so all access
-- goes through Next.js server routes using the service_role key (which bypasses
-- RLS by default). The publishable/anon key is never used against these tables.
grant usage on schema deal_analyzer to service_role;
grant all on all tables in schema deal_analyzer to service_role;
;
