-- A "team_hub" account has role='team_hub' and, by construction, neither
-- 'admin' nor is_leader — so it already fails every admin/leader-gated policy
-- without needing to be named there. What it does NOT already fail is any
-- policy that only checks `authenticated`, which is what crm_transactions,
-- deal_documents and transaction_documents still are. Those are everyday
-- tools for the whole ops team (not just leaders), so the correct exclusion
-- is "authenticated minus team_hub_only", not "admin or leader only".

CREATE OR REPLACE FUNCTION public.is_team_hub_only(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'team_hub'::app_role
  )
  AND NOT public.has_role(_user_id, 'admin'::app_role)
  AND NOT public.is_leader(_user_id);
$$;

-- crm_transactions: insert/delete were already creator-or-admin scoped, but a
-- team_hub account could still satisfy `created_by = auth.uid()` on its own
-- rows, so add the exclusion there too rather than relying on select/update
-- alone to keep them out.
DROP POLICY IF EXISTS crm_transactions_select ON public.crm_transactions;
CREATE POLICY crm_transactions_select ON public.crm_transactions
  FOR SELECT TO authenticated USING (NOT is_team_hub_only(auth.uid()));

DROP POLICY IF EXISTS crm_transactions_update ON public.crm_transactions;
CREATE POLICY crm_transactions_update ON public.crm_transactions
  FOR UPDATE TO authenticated USING (NOT is_team_hub_only(auth.uid()));

DROP POLICY IF EXISTS crm_transactions_insert ON public.crm_transactions;
CREATE POLICY crm_transactions_insert ON public.crm_transactions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by AND NOT is_team_hub_only(auth.uid()));

DROP POLICY IF EXISTS crm_transactions_delete ON public.crm_transactions;
CREATE POLICY crm_transactions_delete ON public.crm_transactions
  FOR DELETE TO authenticated
  USING ((auth.uid() = created_by OR has_role(auth.uid(), 'admin'::app_role))
         AND NOT is_team_hub_only(auth.uid()));

-- deal_documents — exact policy names verified via pg_policy, not guessed.
DROP POLICY IF EXISTS "Team can view deal docs" ON public.deal_documents;
DROP POLICY IF EXISTS "Team can insert deal docs" ON public.deal_documents;
DROP POLICY IF EXISTS "Team can update deal docs" ON public.deal_documents;
DROP POLICY IF EXISTS "Team can delete deal docs" ON public.deal_documents;
CREATE POLICY deal_documents_select ON public.deal_documents
  FOR SELECT TO authenticated USING (NOT is_team_hub_only(auth.uid()));
CREATE POLICY deal_documents_insert ON public.deal_documents
  FOR INSERT TO authenticated WITH CHECK (NOT is_team_hub_only(auth.uid()));
CREATE POLICY deal_documents_update ON public.deal_documents
  FOR UPDATE TO authenticated USING (NOT is_team_hub_only(auth.uid()));
CREATE POLICY deal_documents_delete ON public.deal_documents
  FOR DELETE TO authenticated USING (NOT is_team_hub_only(auth.uid()));

-- transaction_documents — same treatment, exact verified names.
DROP POLICY IF EXISTS "Team can view documents" ON public.transaction_documents;
DROP POLICY IF EXISTS "Team can insert documents" ON public.transaction_documents;
DROP POLICY IF EXISTS "Team can update documents" ON public.transaction_documents;
DROP POLICY IF EXISTS "Team can delete documents" ON public.transaction_documents;
CREATE POLICY transaction_documents_select ON public.transaction_documents
  FOR SELECT TO authenticated USING (NOT is_team_hub_only(auth.uid()));
CREATE POLICY transaction_documents_insert ON public.transaction_documents
  FOR INSERT TO authenticated WITH CHECK (NOT is_team_hub_only(auth.uid()));
CREATE POLICY transaction_documents_update ON public.transaction_documents
  FOR UPDATE TO authenticated USING (NOT is_team_hub_only(auth.uid()));
CREATE POLICY transaction_documents_delete ON public.transaction_documents
  FOR DELETE TO authenticated USING (NOT is_team_hub_only(auth.uid()));;
