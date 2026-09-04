CREATE TABLE department_pinboard (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  department_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'link',
  title text NOT NULL,
  url text,
  description text DEFAULT '',
  icon text,
  sort_order integer DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE department_pinboard ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view pinboard"
  ON department_pinboard FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert pinboard"
  ON department_pinboard FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Creators and admins can delete pinboard"
  ON department_pinboard FOR DELETE
  USING (created_by = auth.uid() OR has_role(auth.uid(), 'admin'));;
