CREATE TABLE IF NOT EXISTS public.crm_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL,
  deal_id UUID REFERENCES public.deals(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES public.crm_transactions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  assigned_to UUID,
  due_date DATE,
  is_complete BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS crm_tasks_deal_id_idx ON public.crm_tasks(deal_id);
CREATE INDEX IF NOT EXISTS crm_tasks_transaction_id_idx ON public.crm_tasks(transaction_id);
CREATE INDEX IF NOT EXISTS crm_tasks_workspace_id_idx ON public.crm_tasks(workspace_id);

ALTER TABLE public.crm_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view crm tasks"
  ON public.crm_tasks FOR SELECT TO authenticated
  USING (workspace_id = public.get_user_workspace_id());

CREATE POLICY "Workspace members can create crm tasks"
  ON public.crm_tasks FOR INSERT TO authenticated
  WITH CHECK (workspace_id = public.get_user_workspace_id() AND created_by = auth.uid());

CREATE POLICY "Creators, assignees and admins can update crm tasks"
  ON public.crm_tasks FOR UPDATE TO authenticated
  USING (
    workspace_id = public.get_user_workspace_id()
    AND (created_by = auth.uid() OR assigned_to = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  );

CREATE POLICY "Creators and admins can delete crm tasks"
  ON public.crm_tasks FOR DELETE TO authenticated
  USING (
    workspace_id = public.get_user_workspace_id()
    AND (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  );

CREATE TRIGGER crm_tasks_updated_at
  BEFORE UPDATE ON public.crm_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();