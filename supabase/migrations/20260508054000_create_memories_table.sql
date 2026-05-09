-- Persistent agent memory storage with vector embeddings.
-- This migration is safe to run more than once and grants the anon role the
-- read/write access needed by browser/client-side agents.

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1536),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_memories_agent_id
  ON public.memories (agent_id);

CREATE INDEX IF NOT EXISTS idx_memories_created_at
  ON public.memories (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_memories_metadata
  ON public.memories USING GIN (metadata);

CREATE INDEX IF NOT EXISTS idx_memories_embedding_cosine
  ON public.memories USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100)
  WHERE embedding IS NOT NULL;

CREATE OR REPLACE FUNCTION public.update_memories_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_memories_updated_at ON public.memories;
CREATE TRIGGER trg_update_memories_updated_at
  BEFORE UPDATE ON public.memories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_memories_updated_at();

GRANT SELECT, INSERT ON public.memories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.memories TO authenticated;
GRANT ALL ON public.memories TO service_role;

ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anon can read memories" ON public.memories;
CREATE POLICY "Anon can read memories"
  ON public.memories
  FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "Anon can insert memories" ON public.memories;
CREATE POLICY "Anon can insert memories"
  ON public.memories
  FOR INSERT
  TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can manage memories" ON public.memories;
CREATE POLICY "Authenticated users can manage memories"
  ON public.memories
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage memories" ON public.memories;
CREATE POLICY "Service role can manage memories"
  ON public.memories
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
