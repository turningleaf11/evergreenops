
-- 1. Notes sharing fields
ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS share_token text UNIQUE,
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS shared_with jsonb NOT NULL DEFAULT '{"memberIds":[]}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_notes_share_token ON public.notes(share_token) WHERE share_token IS NOT NULL;

-- Public read for notes marked public (anon + authenticated)
DROP POLICY IF EXISTS "Public can view public notes" ON public.notes;
CREATE POLICY "Public can view public notes"
  ON public.notes FOR SELECT
  TO anon, authenticated
  USING (is_public = true);

-- Teammates with shared access can read
DROP POLICY IF EXISTS "Shared users can view notes" ON public.notes;
CREATE POLICY "Shared users can view notes"
  ON public.notes FOR SELECT
  TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND shared_with ? 'memberIds'
    AND (shared_with->'memberIds') @> to_jsonb(auth.uid()::text)
  );

-- 2. Email labels
CREATE TABLE IF NOT EXISTS public.email_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#3b82f6',
  gmail_label_id text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_labels_workspace ON public.email_labels(workspace_id);

ALTER TABLE public.email_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members view labels"
  ON public.email_labels FOR SELECT
  TO authenticated
  USING (workspace_id = public.get_user_workspace_id());

CREATE POLICY "Workspace members manage labels"
  ON public.email_labels FOR ALL
  TO authenticated
  USING (workspace_id = public.get_user_workspace_id())
  WITH CHECK (workspace_id = public.get_user_workspace_id());

CREATE TRIGGER update_email_labels_updated_at
  BEFORE UPDATE ON public.email_labels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
