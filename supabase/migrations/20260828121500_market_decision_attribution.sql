-- Extends the row-level human/AI attribution to the market's decision fields
-- themselves. Without this, a monthly AI re-score would silently overwrite
-- a human's own decision/why/next-step -- the exact thing the row-level
-- updated_by_kind guard was built to prevent, just one level up.

alter table public.markets
  add column if not exists decision_updated_by_kind text not null default 'ai' check (decision_updated_by_kind in ('ai', 'human')),
  add column if not exists decision_updated_by uuid;

-- Backfill: every market currently carrying a decision was set by Alexander's
-- seeded workbook data (human), not by an AI run -- attribute it correctly
-- so the first automatic re-score doesn't treat his calls as fair game.
update public.markets
set decision_updated_by_kind = 'human',
    decision_updated_by = '07d7e929-345e-4b1f-a681-6191739169b7'
where decision is not null;
