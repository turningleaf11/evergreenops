-- pgvector similarity search helper for the agent memory system.

CREATE OR REPLACE FUNCTION public.match_memories(
  query_embedding vector(1536),
  match_count INT DEFAULT 5,
  filter_agent_id TEXT DEFAULT NULL,
  filter_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  id UUID,
  agent_id TEXT,
  content TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  similarity DOUBLE PRECISION
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    memories.id,
    memories.agent_id,
    memories.content,
    memories.metadata,
    memories.created_at,
    memories.updated_at,
    1 - (memories.embedding <=> query_embedding) AS similarity
  FROM public.memories
  WHERE memories.embedding IS NOT NULL
    AND (filter_agent_id IS NULL OR memories.agent_id = filter_agent_id)
    AND (filter_metadata = '{}'::jsonb OR memories.metadata @> filter_metadata)
  ORDER BY memories.embedding <=> query_embedding
  LIMIT GREATEST(match_count, 1);
$$;

GRANT EXECUTE ON FUNCTION public.match_memories(vector(1536), INT, TEXT, JSONB) TO anon;
GRANT EXECUTE ON FUNCTION public.match_memories(vector(1536), INT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_memories(vector(1536), INT, TEXT, JSONB) TO service_role;
