-- Custom field definitions per workspace + entity_type (contact|deal|company)
CREATE TABLE IF NOT EXISTS public.crm_custom_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('contact','deal','company')),
  field_key text NOT NULL,
  label text NOT NULL,
  field_type text NOT NULL CHECK (field_type IN ('text','number','date','select','multi_select','checkbox','url','textarea')),
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  required boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, entity_type, field_key)
);

CREATE INDEX IF NOT EXISTS idx_crm_cf_ws ON public.crm_custom_fields(workspace_id, entity_type, sort_order);

ALTER TABLE public.crm_custom_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace can view custom fields"
  ON public.crm_custom_fields FOR SELECT TO authenticated
  USING (workspace_id = public.get_user_workspace_id());

CREATE POLICY "Admins manage custom fields"
  ON public.crm_custom_fields FOR ALL TO authenticated
  USING (workspace_id = public.get_user_workspace_id() AND public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (workspace_id = public.get_user_workspace_id() AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_crm_cf_updated
BEFORE UPDATE ON public.crm_custom_fields
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add custom field value bags
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb;