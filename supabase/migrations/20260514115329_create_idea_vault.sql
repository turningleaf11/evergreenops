
CREATE TABLE IF NOT EXISTS idea_vault (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title            TEXT NOT NULL,
  description      TEXT,
  status           TEXT NOT NULL DEFAULT 'captured',
  source           TEXT NOT NULL DEFAULT 'manual',
  ai_cluster       TEXT,
  ai_summary       TEXT,
  effort_estimate  TEXT,
  time_horizon     TEXT,
  promoted_to_type TEXT,
  promoted_to_id   TEXT,
  promoted_at      TIMESTAMPTZ,
  created_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  workspace_id     UUID,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE idea_vault ENABLE ROW LEVEL SECURITY;

-- Users can read all ideas in their workspace (or their own if no workspace)
CREATE POLICY "idea_vault_select" ON idea_vault
  FOR SELECT USING (
    auth.uid() = created_by
    OR workspace_id IN (
      SELECT workspace_id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Users can insert their own ideas
CREATE POLICY "idea_vault_insert" ON idea_vault
  FOR INSERT WITH CHECK (auth.uid() = created_by);

-- Users can update any idea in their workspace
CREATE POLICY "idea_vault_update" ON idea_vault
  FOR UPDATE USING (
    auth.uid() = created_by
    OR workspace_id IN (
      SELECT workspace_id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Users can delete their own ideas
CREATE POLICY "idea_vault_delete" ON idea_vault
  FOR DELETE USING (auth.uid() = created_by);
;
