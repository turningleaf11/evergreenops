CREATE TABLE IF NOT EXISTS public.council_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'done', 'failed', 'cancelled')),
  participants jsonb NOT NULL DEFAULT '[]'::jsonb,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.council_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.council_sessions(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES public.agents(id) ON DELETE SET NULL,
  agent_name text NOT NULL,
  agent_emoji text,
  body text NOT NULL,
  position int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_council_sessions_workspace_created
  ON public.council_sessions(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_council_messages_session_position
  ON public.council_messages(session_id, position, created_at);

CREATE OR REPLACE FUNCTION public.council_sessions_set_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ws uuid;
BEGIN
  IF NEW.workspace_id IS NULL AND auth.uid() IS NOT NULL THEN
    SELECT workspace_id INTO ws
      FROM public.profiles
     WHERE user_id = auth.uid()
     LIMIT 1;

    IF ws IS NULL THEN
      RAISE EXCEPTION 'Your account is not assigned to a workspace';
    END IF;

    NEW.workspace_id := ws;
  END IF;

  NEW.status := COALESCE(NEW.status, 'running');
  NEW.participants := COALESCE(NEW.participants, '[]'::jsonb);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_council_sessions_set_defaults ON public.council_sessions;
CREATE TRIGGER trg_council_sessions_set_defaults
BEFORE INSERT ON public.council_sessions
FOR EACH ROW EXECUTE FUNCTION public.council_sessions_set_defaults();

ALTER TABLE public.council_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.council_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace members view council sessions" ON public.council_sessions;
CREATE POLICY "Workspace members view council sessions"
ON public.council_sessions
FOR SELECT
TO authenticated
USING (workspace_id = public.get_user_workspace_id());

DROP POLICY IF EXISTS "Workspace members create council sessions" ON public.council_sessions;
CREATE POLICY "Workspace members create council sessions"
ON public.council_sessions
FOR INSERT
TO authenticated
WITH CHECK (workspace_id = public.get_user_workspace_id());

DROP POLICY IF EXISTS "Workspace members update council sessions" ON public.council_sessions;
CREATE POLICY "Workspace members update council sessions"
ON public.council_sessions
FOR UPDATE
TO authenticated
USING (workspace_id = public.get_user_workspace_id())
WITH CHECK (workspace_id = public.get_user_workspace_id());

DROP POLICY IF EXISTS "Workspace members view council messages" ON public.council_messages;
CREATE POLICY "Workspace members view council messages"
ON public.council_messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.council_sessions s
    WHERE s.id = council_messages.session_id
      AND s.workspace_id = public.get_user_workspace_id()
  )
);

DROP POLICY IF EXISTS "Workspace members create council messages" ON public.council_messages;
CREATE POLICY "Workspace members create council messages"
ON public.council_messages
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.council_sessions s
    WHERE s.id = council_messages.session_id
      AND s.workspace_id = public.get_user_workspace_id()
  )
);

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.council_sessions;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.council_messages;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
