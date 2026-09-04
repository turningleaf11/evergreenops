
CREATE TABLE IF NOT EXISTS workspace_settings (
  workspace_id TEXT PRIMARY KEY,
  realtime_provider TEXT NOT NULL DEFAULT 'openai',
  openai_model TEXT NOT NULL DEFAULT 'gpt-4o-realtime-preview',
  gemini_model TEXT NOT NULL DEFAULT 'gemini-2.0-flash-live-001',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed the default workspace row
INSERT INTO workspace_settings (workspace_id, realtime_provider, openai_model, gemini_model)
VALUES ('turning-leaf', 'openai', 'gpt-4o-realtime-preview', 'gemini-2.0-flash-live-001')
ON CONFLICT (workspace_id) DO NOTHING;
;
