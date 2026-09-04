ALTER TABLE public.dispo_deal_assets RENAME COLUMN deal_id TO transaction_id;
ALTER TABLE public.dispo_deal_assets ADD CONSTRAINT dispo_deal_assets_transaction_id_fkey
  FOREIGN KEY (transaction_id) REFERENCES public.crm_transactions(id) ON DELETE CASCADE;;
