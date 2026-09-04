-- Lock down the AI memory system for backend/service-only access.
-- public.memories may contain sensitive agent context, tool outputs, decisions,
-- project notes, and user/company preferences. Browser clients should not read
-- or write these rows directly.

ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;

-- Remove direct table access from browser/client roles.
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.memories FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.memories FROM authenticated;

-- Remove permissive policies created during the initial prototype migration.
DROP POLICY IF EXISTS "Anon can read memories" ON public.memories;
DROP POLICY IF EXISTS "Anon can insert memories" ON public.memories;
DROP POLICY IF EXISTS "Authenticated users can manage memories" ON public.memories;

-- Keep memory access service-only for v1. Server-side code should use the
-- Supabase service role key from a protected runtime environment.
DROP POLICY IF EXISTS "Service role can manage memories" ON public.memories;
CREATE POLICY "Service role can manage memories"
  ON public.memories
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Prevent browser/client roles from invoking semantic memory search directly.
REVOKE EXECUTE ON FUNCTION public.match_memories(vector(1536), INT, TEXT, JSONB) FROM anon;
REVOKE EXECUTE ON FUNCTION public.match_memories(vector(1536), INT, TEXT, JSONB) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.match_memories(vector(1536), INT, TEXT, JSONB) TO service_role;
