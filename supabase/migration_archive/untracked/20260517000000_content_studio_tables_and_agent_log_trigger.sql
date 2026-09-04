-- Mirror of the migration applied via the Supabase MCP on 2026-05-17.
-- Adds Content Studio tables (brands + library) and an agent_tasks → ai_logs
-- mirror trigger so the AI Hub Logs surface has a real feed.

CREATE TABLE IF NOT EXISTS public.content_brands (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  audience TEXT NOT NULL DEFAULT '',
  voice TEXT NOT NULL DEFAULT '',
  mission TEXT NOT NULL DEFAULT '',
  seeds JSONB NOT NULL DEFAULT '[]'::jsonb,
  canva_kit_id TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS content_brands_user_idx ON public.content_brands(user_id);
ALTER TABLE public.content_brands ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "content_brands_own" ON public.content_brands;
CREATE POLICY "content_brands_own" ON public.content_brands FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.content_library (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID,
  brand_id UUID REFERENCES public.content_brands(id) ON DELETE SET NULL,
  brand_name TEXT NOT NULL DEFAULT '',
  brand_color TEXT NOT NULL DEFAULT '#3b82f6',
  platform TEXT NOT NULL DEFAULT '',
  platform_label TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  seed TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','posted','archived')),
  canva_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS content_library_user_idx ON public.content_library(user_id);
CREATE INDEX IF NOT EXISTS content_library_brand_idx ON public.content_library(brand_id);
ALTER TABLE public.content_library ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "content_library_own" ON public.content_library;
CREATE POLICY "content_library_own" ON public.content_library FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS content_brands_set_updated ON public.content_brands;
CREATE TRIGGER content_brands_set_updated BEFORE UPDATE ON public.content_brands FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Expand ai_logs.category to cover the full task lifecycle and future event types.
ALTER TABLE public.ai_logs DROP CONSTRAINT IF EXISTS ai_logs_category_check;
ALTER TABLE public.ai_logs ADD CONSTRAINT ai_logs_category_check
  CHECK (category = ANY (ARRAY['task_created','task_status','task_updated','task_started','task_completed','task_failed','agent_message','agent_thought','agent_tool']));

CREATE OR REPLACE FUNCTION public.ai_log_agent_task_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_category TEXT;
  v_message TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_category := 'task_created';
    v_message := COALESCE(NEW.title, 'Task created');
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      v_category := CASE
        WHEN NEW.status = 'completed' THEN 'task_completed'
        WHEN NEW.status = 'failed' THEN 'task_failed'
        WHEN NEW.status = 'in_progress' OR NEW.status = 'running' THEN 'task_started'
        ELSE 'task_status'
      END;
      v_message := COALESCE(NEW.title, 'Task') || ' → ' || COALESCE(NEW.status, 'updated');
    ELSE
      v_category := 'task_updated';
      v_message := COALESCE(NEW.title, 'Task updated');
    END IF;
  END IF;

  INSERT INTO public.ai_logs (task_id, agent_id, agent_name, agent_emoji, category, message)
  VALUES (NEW.id, NULL, COALESCE(NEW.assigned_to, 'Agent'), '🤖', v_category, v_message);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS agent_tasks_to_ai_logs ON public.agent_tasks;
CREATE TRIGGER agent_tasks_to_ai_logs AFTER INSERT OR UPDATE ON public.agent_tasks FOR EACH ROW EXECUTE FUNCTION public.ai_log_agent_task_change();
