-- Deliverables need an owner and a date, not just a status — "realtor script
-- guide" is unanswerable as work until you know who's writing it and by when.
alter table public.business_plan_deliverables
  add column if not exists owner_id uuid references auth.users(id) on delete set null,
  add column if not exists due_date date;

create index if not exists business_plan_deliverables_owner_idx
  on public.business_plan_deliverables (owner_id);
;
