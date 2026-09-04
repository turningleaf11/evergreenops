-- Business Plan Doc: a single freeform working doc per plan, separate from
-- the Wiki pages system (Workspace tab). This is the "clean piece of paper"
-- surface — write raw notes/ideas here, then ask Albus to read it and draft
-- deliverables. One doc per plan, not a linkable N:1 table like documents/
-- whiteboards, so it lives directly on business_plans.

alter table public.business_plans
  add column if not exists plan_doc text not null default '';
;
