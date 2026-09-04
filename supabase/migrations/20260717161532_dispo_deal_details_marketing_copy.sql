-- The most recently AI-generated marketing copy for a deal (listing description
-- + buyer email, EN/ES). Overwritten each regenerate; persisted so switching
-- tabs or reopening the deal keeps the last draft. Shape mirrors the
-- deal-copy-generate function output.
alter table public.dispo_deal_details
  add column if not exists marketing_copy jsonb;;
