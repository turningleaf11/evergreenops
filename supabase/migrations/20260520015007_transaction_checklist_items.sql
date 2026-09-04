CREATE TABLE IF NOT EXISTS public.transaction_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.crm_transactions(id) ON DELETE CASCADE,
  label text NOT NULL,
  is_complete boolean NOT NULL DEFAULT false,
  due_date date,
  completed_at timestamptz,
  completed_by uuid,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tx_checklist_tx ON public.transaction_checklist_items(transaction_id);

CREATE OR REPLACE FUNCTION public.crm_tx_seed_checklist()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE items text[]; i int;
BEGIN
  IF NEW.transaction_type = 'assign' THEN
    items := ARRAY['Purchase agreement signed and executed','Assignment agreement drafted','Buyer earnest money received','Earnest money delivered to title','Title company notified of assignment','Assignment fee confirmed in writing','All parties have signed assignment agreement','Closing statement reviewed and approved','Closed'];
  ELSIF NEW.transaction_type = 'double_close' THEN
    items := ARRAY['A-B purchase agreement executed','B-C purchase agreement executed','Transactional funding arranged and confirmed','Title company briefed on double close structure','Buyer earnest money received','A-B closing scheduled','B-C closing scheduled','Transactional funds wired','A-B closed','B-C closed'];
  ELSIF NEW.transaction_type = 'buy' THEN
    items := ARRAY['Purchase agreement executed','Earnest money sent','Inspection scheduled','Inspection completed','Inspection objections resolved','Title ordered','Title commitment received and reviewed','Financing confirmed / proof of funds submitted','Clear to close received','Final walkthrough complete','Closing date confirmed with all parties','Closed'];
  END IF;
  IF items IS NOT NULL THEN
    FOR i IN 1..array_length(items, 1) LOOP
      INSERT INTO public.transaction_checklist_items (transaction_id, label, sort_order) VALUES (NEW.id, items[i], i);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS crm_tx_seed_checklist_trg ON public.crm_transactions;
CREATE TRIGGER crm_tx_seed_checklist_trg AFTER INSERT ON public.crm_transactions FOR EACH ROW EXECUTE FUNCTION public.crm_tx_seed_checklist();

ALTER TABLE public.transaction_checklist_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tx_items_select" ON public.transaction_checklist_items;
CREATE POLICY "tx_items_select" ON public.transaction_checklist_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.crm_transactions t WHERE t.id = transaction_id AND t.workspace_id = public.get_user_workspace_id()));
DROP POLICY IF EXISTS "tx_items_insert" ON public.transaction_checklist_items;
CREATE POLICY "tx_items_insert" ON public.transaction_checklist_items FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.crm_transactions t WHERE t.id = transaction_id AND t.workspace_id = public.get_user_workspace_id()));
DROP POLICY IF EXISTS "tx_items_update" ON public.transaction_checklist_items;
CREATE POLICY "tx_items_update" ON public.transaction_checklist_items FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.crm_transactions t WHERE t.id = transaction_id AND t.workspace_id = public.get_user_workspace_id()));
DROP POLICY IF EXISTS "tx_items_delete" ON public.transaction_checklist_items;
CREATE POLICY "tx_items_delete" ON public.transaction_checklist_items FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.crm_transactions t WHERE t.id = transaction_id AND t.workspace_id = public.get_user_workspace_id()));;
