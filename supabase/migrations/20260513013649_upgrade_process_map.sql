
-- Extend process_buckets with positions, color, hierarchy, type
ALTER TABLE process_buckets
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS color text DEFAULT '#6366f1',
  ADD COLUMN IF NOT EXISTS position_x float DEFAULT 0,
  ADD COLUMN IF NOT EXISTS position_y float DEFAULT 0,
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES process_buckets(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS node_type text DEFAULT 'area';

-- Persist edges between nodes
CREATE TABLE IF NOT EXISTS process_edges (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  source_id uuid NOT NULL REFERENCES process_buckets(id) ON DELETE CASCADE,
  target_id uuid NOT NULL REFERENCES process_buckets(id) ON DELETE CASCADE,
  label text,
  edge_type text DEFAULT 'smoothstep',
  created_at timestamptz DEFAULT now()
);

-- Annotations: pain points, ideas, observations — not required to become a project
CREATE TABLE IF NOT EXISTS process_annotations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  bucket_id uuid NOT NULL REFERENCES process_buckets(id) ON DELETE CASCADE,
  annotation_type text NOT NULL DEFAULT 'idea',
  title text NOT NULL,
  content text,
  status text DEFAULT 'open',
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE process_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_annotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_process_edges" ON process_edges
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "auth_all_process_annotations" ON process_annotations
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- Clear old pipeline-stage seed data, replace with real business areas
DELETE FROM bucket_projects;
DELETE FROM process_steps;
DELETE FROM process_buckets;

INSERT INTO process_buckets (slug, name, description, color, position_x, position_y, bucket_order, node_type) VALUES
  ('lead-gen',     'Lead Generation', 'MLS DTA leads, lists (Dealmachine), SEO partner — GHL workflows, email triage, CRM hygiene', '#10b981', 80,  80,  1, 'area'),
  ('acquisitions', 'Acquisitions',    'Orbit program, seller calls, underwriting/comps, offer gen & follow-up', '#6366f1', 420, 80,  2, 'area'),
  ('dispo',        'Dispo',           'Buyer network, marketing automation, TC/contracts, assignment closing, dispo site', '#f59e0b', 760, 80,  3, 'area'),
  ('portfolio',    'Portfolio',       'Value-add assets, renovations, capital partner outreach, hold/exit modeling', '#3b82f6', 80,  320, 4, 'area'),
  ('design',       'Design Practice', 'Interior design — in-house Evergreen projects + external client intake', '#ec4899', 420, 320, 5, 'area'),
  ('operations',   'Operations',      'Team systems, AI infrastructure, resource center, reporting, content creation', '#8b5cf6', 760, 320, 6, 'area');
;
