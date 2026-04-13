
CREATE TABLE public.database_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  database_id uuid NOT NULL REFERENCES public.databases_meta(id) ON DELETE CASCADE,
  name text NOT NULL,
  view_type text NOT NULL DEFAULT 'table',
  filters jsonb NOT NULL DEFAULT '[]'::jsonb,
  sorts jsonb NOT NULL DEFAULT '[]'::jsonb,
  group_by text DEFAULT NULL,
  column_order text[] NOT NULL DEFAULT '{}'::text[],
  created_by uuid DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.database_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view saved views"
  ON public.database_views FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create saved views"
  ON public.database_views FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creators can update their saved views"
  ON public.database_views FOR UPDATE TO authenticated
  USING (auth.uid() = created_by);

CREATE POLICY "Creators can delete their saved views"
  ON public.database_views FOR DELETE TO authenticated
  USING (auth.uid() = created_by);

CREATE POLICY "Admins can manage all saved views"
  ON public.database_views FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
