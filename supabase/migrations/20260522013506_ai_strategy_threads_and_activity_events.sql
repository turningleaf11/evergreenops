CREATE TABLE IF NOT EXISTS public.activity_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id UUID,
  actor_name TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  entity_title TEXT,
  department_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can view activity" ON public.activity_events;
CREATE POLICY "Authenticated users can view activity" ON public.activity_events FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can create activity" ON public.activity_events;
CREATE POLICY "Authenticated users can create activity" ON public.activity_events FOR INSERT TO authenticated WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.ai_strategy_threads (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid,
  created_by uuid NOT NULL,
  title text NOT NULL DEFAULT 'New conversation',
  thread_type text NOT NULL DEFAULT 'general',
  status text NOT NULL DEFAULT 'active',
  summary text,
  summary_updated_at timestamptz,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_strategy_threads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Creators and admins can view threads" ON public.ai_strategy_threads;
CREATE POLICY "Creators and admins can view threads" ON public.ai_strategy_threads FOR SELECT TO authenticated
  USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Authenticated users can create their own threads" ON public.ai_strategy_threads;
CREATE POLICY "Authenticated users can create their own threads" ON public.ai_strategy_threads FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);
DROP POLICY IF EXISTS "Creators and admins can update threads" ON public.ai_strategy_threads;
CREATE POLICY "Creators and admins can update threads" ON public.ai_strategy_threads FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Creators and admins can delete threads" ON public.ai_strategy_threads;
CREATE POLICY "Creators and admins can delete threads" ON public.ai_strategy_threads FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX IF NOT EXISTS idx_ai_strategy_threads_created_by ON public.ai_strategy_threads(created_by);
CREATE INDEX IF NOT EXISTS idx_ai_strategy_threads_last_message_at ON public.ai_strategy_threads(last_message_at DESC);

CREATE TABLE IF NOT EXISTS public.ai_strategy_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id uuid NOT NULL REFERENCES public.ai_strategy_threads(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL DEFAULT '',
  context_snapshot jsonb,
  saved_to_type text,
  saved_to_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_strategy_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "View messages of accessible threads" ON public.ai_strategy_messages;
CREATE POLICY "View messages of accessible threads" ON public.ai_strategy_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ai_strategy_threads t WHERE t.id = ai_strategy_messages.thread_id AND (t.created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))));
DROP POLICY IF EXISTS "Insert messages into accessible threads" ON public.ai_strategy_messages;
CREATE POLICY "Insert messages into accessible threads" ON public.ai_strategy_messages FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.ai_strategy_threads t WHERE t.id = ai_strategy_messages.thread_id AND (t.created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))));
DROP POLICY IF EXISTS "Update messages of accessible threads" ON public.ai_strategy_messages;
CREATE POLICY "Update messages of accessible threads" ON public.ai_strategy_messages FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ai_strategy_threads t WHERE t.id = ai_strategy_messages.thread_id AND (t.created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))));
DROP POLICY IF EXISTS "Delete messages of accessible threads" ON public.ai_strategy_messages;
CREATE POLICY "Delete messages of accessible threads" ON public.ai_strategy_messages FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ai_strategy_threads t WHERE t.id = ai_strategy_messages.thread_id AND (t.created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))));
CREATE INDEX IF NOT EXISTS idx_ai_strategy_messages_thread ON public.ai_strategy_messages(thread_id, created_at);

CREATE TABLE IF NOT EXISTS public.ai_business_memory (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid,
  memory_type text NOT NULL,
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  source_thread_id uuid REFERENCES public.ai_strategy_threads(id) ON DELETE SET NULL,
  source_message_id uuid REFERENCES public.ai_strategy_messages(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);
ALTER TABLE public.ai_business_memory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage business memory" ON public.ai_business_memory;
CREATE POLICY "Admins manage business memory" ON public.ai_business_memory FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));;
