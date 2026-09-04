
create table public.deal_analyzer_deals (like deal_analyzer.deals including all);
create table public.deal_analyzer_documents (like deal_analyzer.documents including all);

alter table public.deal_analyzer_documents
  add constraint deal_analyzer_documents_deal_id_fkey
  foreign key (deal_id) references public.deal_analyzer_deals(id) on delete cascade;

alter table public.deal_analyzer_deals enable row level security;
alter table public.deal_analyzer_documents enable row level security;

-- No anon/authenticated policies: access only via server routes using service_role,
-- which bypasses RLS by default.
grant all on public.deal_analyzer_deals to service_role;
grant all on public.deal_analyzer_documents to service_role;
;
