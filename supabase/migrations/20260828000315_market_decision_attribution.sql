alter table public.markets
  add column if not exists decision_updated_by_kind text not null default 'ai' check (decision_updated_by_kind in ('ai', 'human')),
  add column if not exists decision_updated_by uuid;

update public.markets
set decision_updated_by_kind = 'human',
    decision_updated_by = '07d7e929-345e-4b1f-a681-6191739169b7'
where decision is not null;
;
