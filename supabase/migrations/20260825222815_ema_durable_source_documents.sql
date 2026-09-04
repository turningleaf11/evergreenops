-- Durable source-document content for Ema/Cash/Albus.
-- Preserve the complete bounded text extracted from source PDFs so downstream
-- agents and humans do not depend on re-reading the Gmail attachment or on the
-- subset of facts that happen to fit ema_candidates.extracted_facts.

alter table public.ema_candidate_documents
  drop constraint if exists ema_candidate_documents_document_type_check;

alter table public.ema_candidate_documents
  add constraint ema_candidate_documents_document_type_check
  check (document_type in ('source_pdf','om','rent_roll','t12','pnl'));

alter table public.ema_candidate_documents
  add column if not exists extraction_status text not null default 'not_attempted',
  add column if not exists extraction_method text,
  add column if not exists extracted_text text,
  add column if not exists extracted_text_chars integer not null default 0,
  add column if not exists total_pages integer,
  add column if not exists content_sha256 text,
  add column if not exists source_metadata jsonb not null default '{}'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

alter table public.ema_candidate_documents
  drop constraint if exists ema_candidate_documents_extraction_status_check;
alter table public.ema_candidate_documents
  add constraint ema_candidate_documents_extraction_status_check
  check (extraction_status in ('not_attempted','succeeded','empty_text','failed','unsupported'));

alter table public.ema_candidate_documents
  drop constraint if exists ema_candidate_documents_extracted_text_chars_check;
alter table public.ema_candidate_documents
  add constraint ema_candidate_documents_extracted_text_chars_check
  check (extracted_text_chars between 0 and 120000);

alter table public.ema_candidate_documents
  drop constraint if exists ema_candidate_documents_total_pages_check;
alter table public.ema_candidate_documents
  add constraint ema_candidate_documents_total_pages_check
  check (total_pages is null or total_pages between 0 and 5000);

alter table public.ema_candidate_documents
  drop constraint if exists ema_candidate_documents_content_sha256_check;
alter table public.ema_candidate_documents
  add constraint ema_candidate_documents_content_sha256_check
  check (content_sha256 is null or content_sha256 ~ '^[0-9a-f]{64}$');

alter table public.ema_candidate_documents
  drop constraint if exists ema_candidate_documents_source_metadata_check;
alter table public.ema_candidate_documents
  add constraint ema_candidate_documents_source_metadata_check
  check (jsonb_typeof(source_metadata) = 'object');

create index if not exists ema_candidate_documents_extraction_idx
  on public.ema_candidate_documents(workspace_id, ema_candidate_id, extraction_status, created_at desc);

create index if not exists ema_candidate_documents_content_sha_idx
  on public.ema_candidate_documents(workspace_id, content_sha256)
  where content_sha256 is not null;

drop trigger if exists ema_candidate_documents_set_updated_at
  on public.ema_candidate_documents;
create trigger ema_candidate_documents_set_updated_at
before update on public.ema_candidate_documents
for each row execute function public.update_updated_at_column();

comment on table public.ema_candidate_documents is
  'Durable Gmail source documents for Ema candidates, including bounded extracted PDF text and portfolio document classification.';
comment on column public.ema_candidate_documents.extracted_text is
  'Complete server-extracted document text up to the 120,000-character safety bound; source content remains untrusted.';
comment on column public.ema_candidate_documents.source_metadata is
  'Bounded provenance and candidate-document matching metadata; never stores credentials.';;
