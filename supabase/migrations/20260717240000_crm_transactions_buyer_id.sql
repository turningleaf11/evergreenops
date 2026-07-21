-- The selected end buyer for a deal, pulled from the buyers list (dispo_buyers).
-- Title/attorney/lender stay contact FKs; the buyer comes from buyers.
alter table public.crm_transactions
  add column if not exists buyer_id uuid references public.dispo_buyers(id) on delete set null;
