-- ai_strategy_threads
CREATE TABLE public.ai_strategy_threads (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid,
  created_by uuid NOT NULL,
  title text NOT NULL DEFAULT 'New conversation',
  thread_type text NOT NULL DEFAULT 'general',
  status text NOT NULL DEFAULT 'active',
  summary text,
  summary_updated_at timestamp with time zone,
  last_message_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_strategy_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Creators and admins can view threads"
ON public.ai_strategy_threads FOR SELECT TO authenticated
USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can create their own threads"
ON public.ai_strategy_threads FOR INSERT TO authenticated
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creators and admins can update threads"
ON public.ai_strategy_threads FOR UPDATE TO authenticated
USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Creators and admins can delete threads"
ON public.ai_strategy_threads FOR DELETE TO authenticated
USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_ai_strategy_threads_created_by ON public.ai_strategy_threads(created_by);
CREATE INDEX idx_ai_strategy_threads_workspace ON public.ai_strategy_threads(workspace_id);
CREATE INDEX idx_ai_strategy_threads_last_message_at ON public.ai_strategy_threads(last_message_at DESC);

-- ai_strategy_messages
CREATE TABLE public.ai_strategy_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id uuid NOT NULL REFERENCES public.ai_strategy_threads(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL DEFAULT '',
  context_snapshot jsonb,
  saved_to_type text,
  saved_to_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_strategy_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View messages of accessible threads"
ON public.ai_strategy_messages FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.ai_strategy_threads t
    WHERE t.id = ai_strategy_messages.thread_id
      AND (t.created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  )
);

CREATE POLICY "Insert messages into accessible threads"
ON public.ai_strategy_messages FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.ai_strategy_threads t
    WHERE t.id = ai_strategy_messages.thread_id
      AND (t.created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  )
);

CREATE POLICY "Update messages of accessible threads"
ON public.ai_strategy_messages FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.ai_strategy_threads t
    WHERE t.id = ai_strategy_messages.thread_id
      AND (t.created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  )
);

CREATE POLICY "Delete messages of accessible threads"
ON public.ai_strategy_messages FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.ai_strategy_threads t
    WHERE t.id = ai_strategy_messages.thread_id
      AND (t.created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  )
);

CREATE INDEX idx_ai_strategy_messages_thread ON public.ai_strategy_messages(thread_id, created_at);

-- ai_business_memory
CREATE TABLE public.ai_business_memory (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid,
  memory_type text NOT NULL,
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  source_thread_id uuid REFERENCES public.ai_strategy_threads(id) ON DELETE SET NULL,
  source_message_id uuid REFERENCES public.ai_strategy_messages(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone
);

ALTER TABLE public.ai_business_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage business memory"
ON public.ai_business_memory FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_ai_business_memory_workspace ON public.ai_business_memory(workspace_id);
CREATE INDEX idx_ai_business_memory_type ON public.ai_business_memory(memory_type);