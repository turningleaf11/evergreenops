
CREATE TABLE IF NOT EXISTS vision (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section text NOT NULL UNIQUE,
  content jsonb NOT NULL DEFAULT '{}',
  sort_order int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

ALTER TABLE vision ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vision_read" ON vision FOR SELECT TO authenticated USING (true);
CREATE POLICY "vision_insert" ON vision FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "vision_update" ON vision FOR UPDATE TO authenticated USING (true);

INSERT INTO vision (section, sort_order, content) VALUES
  ('core_values',        1, '{}'),
  ('core_focus_purpose', 2, '{}'),
  ('core_focus_niche',   3, '{}'),
  ('ten_year_target',    4, '{}'),
  ('three_year_picture', 5, '{}'),
  ('one_year_plan',      6, '{}')
ON CONFLICT (section) DO NOTHING;
;
