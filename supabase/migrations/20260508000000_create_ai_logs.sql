CREATE TABLE IF NOT EXISTS public.ai_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES public.agent_tasks(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
  agent_name TEXT NOT NULL,
  agent_emoji TEXT,
  category TEXT NOT NULL CHECK (category IN ('task_started', 'task_completed', 'task_failed', 'agent_message')),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_logs_created_at ON public.ai_logs(created_at DESC);
CREATE INDEX idx_ai_logs_agent_id ON public.ai_logs(agent_id);
CREATE INDEX idx_ai_logs_task_id ON public.ai_logs(task_id);

ALTER TABLE public.ai_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_logs select authenticated"
  ON public.ai_logs FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "ai_logs insert authenticated"
  ON public.ai_logs FOR INSERT TO authenticated
  WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_logs;
