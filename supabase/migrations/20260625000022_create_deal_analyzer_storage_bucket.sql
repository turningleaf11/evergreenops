
insert into storage.buckets (id, name, public)
values ('deal-analyzer-documents', 'deal-analyzer-documents', false)
on conflict (id) do nothing;
;
