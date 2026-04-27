-- 1. Add new columns to crm_transactions
ALTER TABLE public.crm_transactions
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS primary_contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS disposition_strategy text;

CREATE INDEX IF NOT EXISTS idx_crm_transactions_owner ON public.crm_transactions(owner_id);
CREATE INDEX IF NOT EXISTS idx_crm_transactions_primary_contact ON public.crm_transactions(primary_contact_id);

-- 2. Team members table for transactions
CREATE TABLE IF NOT EXISTS public.transaction_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.crm_transactions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  added_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (transaction_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_tx_team_members_transaction ON public.transaction_team_members(transaction_id);
CREATE INDEX IF NOT EXISTS idx_tx_team_members_user ON public.transaction_team_members(user_id);

ALTER TABLE public.transaction_team_members ENABLE ROW LEVEL SECURITY;

-- Helper: is the user a transaction team member?
CREATE OR REPLACE FUNCTION public.is_transaction_team_member(_transaction_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.transaction_team_members
    WHERE transaction_id = _transaction_id AND user_id = _user_id
  )
$$;

-- RLS for transaction_team_members
DROP POLICY IF EXISTS "tx_team_select" ON public.transaction_team_members;
CREATE POLICY "tx_team_select"
ON public.transaction_team_members
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.crm_transactions t
    WHERE t.id = transaction_id
      AND t.workspace_id = public.get_user_workspace_id()
  )
);

DROP POLICY IF EXISTS "tx_team_insert" ON public.transaction_team_members;
CREATE POLICY "tx_team_insert"
ON public.transaction_team_members
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.crm_transactions t
    WHERE t.id = transaction_id
      AND t.workspace_id = public.get_user_workspace_id()
      AND (
        public.has_role(auth.uid(), 'admin'::app_role)
        OR t.owner_id = auth.uid()
        OR t.created_by = auth.uid()
      )
  )
);

DROP POLICY IF EXISTS "tx_team_delete" ON public.transaction_team_members;
CREATE POLICY "tx_team_delete"
ON public.transaction_team_members
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.crm_transactions t
    WHERE t.id = transaction_id
      AND t.workspace_id = public.get_user_workspace_id()
      AND (
        public.has_role(auth.uid(), 'admin'::app_role)
        OR t.owner_id = auth.uid()
        OR t.created_by = auth.uid()
      )
  )
);

-- 3. Auto-sync from deal on new transaction
CREATE OR REPLACE FUNCTION public.crm_tx_sync_from_deal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d_owner uuid;
  d_primary_contact uuid;
  d_disposition text;
BEGIN
  IF NEW.deal_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT owner_id, primary_contact_id, disposition_strategy
    INTO d_owner, d_primary_contact, d_disposition
    FROM public.deals
   WHERE id = NEW.deal_id;

  IF NEW.owner_id IS NULL THEN NEW.owner_id := d_owner; END IF;
  IF NEW.primary_contact_id IS NULL THEN NEW.primary_contact_id := d_primary_contact; END IF;
  IF NEW.disposition_strategy IS NULL THEN NEW.disposition_strategy := d_disposition; END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS crm_tx_sync_from_deal_trg ON public.crm_transactions;
CREATE TRIGGER crm_tx_sync_from_deal_trg
BEFORE INSERT ON public.crm_transactions
FOR EACH ROW
EXECUTE FUNCTION public.crm_tx_sync_from_deal();

-- 4. Copy deal team members on new transaction
CREATE OR REPLACE FUNCTION public.crm_tx_copy_deal_team()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.deal_id IS NOT NULL THEN
    INSERT INTO public.transaction_team_members (transaction_id, user_id, added_by)
    SELECT NEW.id, dtm.user_id, NEW.created_by
      FROM public.deal_team_members dtm
     WHERE dtm.deal_id = NEW.deal_id
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS crm_tx_copy_deal_team_trg ON public.crm_transactions;
CREATE TRIGGER crm_tx_copy_deal_team_trg
AFTER INSERT ON public.crm_transactions
FOR EACH ROW
EXECUTE FUNCTION public.crm_tx_copy_deal_team();