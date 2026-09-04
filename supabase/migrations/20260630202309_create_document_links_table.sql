create table public.document_links (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index document_links_entity_idx on public.document_links(entity_type, entity_id);
create index document_links_document_idx on public.document_links(document_id);

alter table public.document_links enable row level security;

create policy "authenticated users can read document links"
  on public.document_links for select
  using (auth.uid() is not null);

create policy "authenticated users can insert document links"
  on public.document_links for insert
  with check (auth.uid() is not null);

create policy "authenticated users can delete document links"
  on public.document_links for delete
  using (auth.uid() is not null);;
