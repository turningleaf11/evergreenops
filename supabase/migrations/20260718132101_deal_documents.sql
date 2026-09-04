-- Deal documents (contracts, assignment, HUDs, EMD proof, POF, title). Private
-- storage; AI can extract key dates from an uploaded purchase agreement.
create table if not exists public.deal_documents (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.crm_transactions(id) on delete cascade,
  doc_type text not null default 'other' check (doc_type in (
    'purchase_agreement','assignment_agreement','hud_ab','hud_bc',
    'emd_proof','emd_proof_buyer','proof_of_funds','title_commitment','closing_statement','other'
  )),
  file_name text not null,
  storage_path text not null,
  mime text,
  size_bytes bigint,
  extracted jsonb,
  extraction_status text,           -- null | 'pending' | 'done' | 'error'
  uploaded_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists deal_documents_tx_idx on public.deal_documents (transaction_id, created_at desc);

alter table public.deal_documents enable row level security;
create policy "Team can view deal docs"   on public.deal_documents for select to authenticated using (true);
create policy "Team can insert deal docs" on public.deal_documents for insert to authenticated with check (true);
create policy "Team can update deal docs" on public.deal_documents for update to authenticated using (true);
create policy "Team can delete deal docs" on public.deal_documents for delete to authenticated using (true);

-- Private bucket for the paper. Team-only read/write via signed URLs.
insert into storage.buckets (id, name, public) values ('deal-documents', 'deal-documents', false)
on conflict (id) do nothing;

create policy "Team read deal-documents"   on storage.objects for select to authenticated using (bucket_id = 'deal-documents');
create policy "Team insert deal-documents" on storage.objects for insert to authenticated with check (bucket_id = 'deal-documents');
create policy "Team delete deal-documents" on storage.objects for delete to authenticated using (bucket_id = 'deal-documents');

-- Two dates the PA drives that OpsHQ didn't have yet.
alter table public.crm_transactions
  add column if not exists fully_executed_date date,   -- signed by all parties (original PA)
  add column if not exists emd_due_date date;          -- EMD due on the original contract (we submit);
