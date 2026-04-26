
-- ============ TABLES ============
CREATE TABLE IF NOT EXISTS public.crm_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  lane text NOT NULL DEFAULT 'wholesale',
  transaction_type text NOT NULL DEFAULT 'assign',
  status text NOT NULL DEFAULT 'active',
  property_address text NOT NULL DEFAULT '',
  property_city text,
  property_state text,
  property_type text,
  units integer,
  contract_date date,
  inspection_deadline date,
  due_diligence_end date,
  closing_date date,
  purchase_price numeric,
  assignment_fee numeric,
  earnest_money_required numeric,
  earnest_money_received boolean NOT NULL DEFAULT false,
  earnest_money_received_date date,
  estimated_net numeric,
  actual_net numeric,
  buyer_contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  title_contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  attorney_contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  lender_contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  source_contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_transactions_lane_check CHECK (lane IN ('wholesale','portfolio')),
  CONSTRAINT crm_transactions_type_check CHECK (transaction_type IN ('assign','double_close','buy')),
  CONSTRAINT crm_transactions_status_check CHECK (status IN ('active','closed','cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_crm_transactions_workspace ON public.crm_transactions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_crm_transactions_deal ON public.crm_transactions(deal_id);
CREATE INDEX IF NOT EXISTS idx_crm_transactions_status ON public.crm_transactions(status);
CREATE INDEX IF NOT EXISTS idx_crm_transactions_closing ON public.crm_transactions(closing_date);

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

-- ============ updated_at trigger ============
DROP TRIGGER IF EXISTS crm_transactions_set_updated_at ON public.crm_transactions;
CREATE TRIGGER crm_transactions_set_updated_at
BEFORE UPDATE ON public.crm_transactions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ Auto-populate checklist on insert ============
CREATE OR REPLACE FUNCTION public.crm_tx_seed_checklist()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  items text[];
  i int;
BEGIN
  IF NEW.transaction_type = 'assign' THEN
    items := ARRAY[
      'Purchase agreement signed and executed',
      'Assignment agreement drafted',
      'Buyer earnest money received',
      'Earnest money delivered to title',
      'Title company notified of assignment',
      'Assignment fee confirmed in writing',
      'All parties have signed assignment agreement',
      'Closing statement reviewed and approved',
      'Closed ✓'
    ];
  ELSIF NEW.transaction_type = 'double_close' THEN
    items := ARRAY[
      'A-B purchase agreement executed',
      'B-C purchase agreement executed',
      'Transactional funding arranged and confirmed',
      'Title company briefed on double close structure',
      'Buyer earnest money received',
      'A-B closing scheduled',
      'B-C closing scheduled',
      'Transactional funds wired',
      'A-B closed',
      'B-C closed ✓'
    ];
  ELSIF NEW.transaction_type = 'buy' THEN
    items := ARRAY[
      'Purchase agreement executed',
      'Earnest money sent',
      'Inspection scheduled',
      'Inspection completed',
      'Inspection objections resolved',
      'Title ordered',
      'Title commitment received and reviewed',
      'Financing confirmed / proof of funds submitted',
      'Clear to close received',
      'Final walkthrough complete',
      'Closing date confirmed with all parties',
      'Closed ✓'
    ];
  END IF;

  IF items IS NOT NULL THEN
    FOR i IN 1..array_length(items, 1) LOOP
      INSERT INTO public.transaction_checklist_items (transaction_id, label, sort_order)
      VALUES (NEW.id, items[i], i);
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS crm_tx_seed_checklist_trg ON public.crm_transactions;
CREATE TRIGGER crm_tx_seed_checklist_trg
AFTER INSERT ON public.crm_transactions
FOR EACH ROW EXECUTE FUNCTION public.crm_tx_seed_checklist();

-- ============ RLS ============
ALTER TABLE public.crm_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_checklist_items ENABLE ROW LEVEL SECURITY;

-- transactions
DROP POLICY IF EXISTS "tx_select" ON public.crm_transactions;
CREATE POLICY "tx_select" ON public.crm_transactions
FOR SELECT TO authenticated
USING (workspace_id = public.get_user_workspace_id());

DROP POLICY IF EXISTS "tx_insert" ON public.crm_transactions;
CREATE POLICY "tx_insert" ON public.crm_transactions
FOR INSERT TO authenticated
WITH CHECK (workspace_id = public.get_user_workspace_id() AND created_by = auth.uid());

DROP POLICY IF EXISTS "tx_update" ON public.crm_transactions;
CREATE POLICY "tx_update" ON public.crm_transactions
FOR UPDATE TO authenticated
USING (workspace_id = public.get_user_workspace_id());

DROP POLICY IF EXISTS "tx_delete" ON public.crm_transactions;
CREATE POLICY "tx_delete" ON public.crm_transactions
FOR DELETE TO authenticated
USING (
  workspace_id = public.get_user_workspace_id()
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

-- checklist items inherit access via parent
DROP POLICY IF EXISTS "tx_items_select" ON public.transaction_checklist_items;
CREATE POLICY "tx_items_select" ON public.transaction_checklist_items
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.crm_transactions t
    WHERE t.id = transaction_id AND t.workspace_id = public.get_user_workspace_id()
  )
);

DROP POLICY IF EXISTS "tx_items_insert" ON public.transaction_checklist_items;
CREATE POLICY "tx_items_insert" ON public.transaction_checklist_items
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.crm_transactions t
    WHERE t.id = transaction_id AND t.workspace_id = public.get_user_workspace_id()
  )
);

DROP POLICY IF EXISTS "tx_items_update" ON public.transaction_checklist_items;
CREATE POLICY "tx_items_update" ON public.transaction_checklist_items
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.crm_transactions t
    WHERE t.id = transaction_id AND t.workspace_id = public.get_user_workspace_id()
  )
);

DROP POLICY IF EXISTS "tx_items_delete" ON public.transaction_checklist_items;
CREATE POLICY "tx_items_delete" ON public.transaction_checklist_items
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.crm_transactions t
    WHERE t.id = transaction_id AND t.workspace_id = public.get_user_workspace_id()
  )
);
