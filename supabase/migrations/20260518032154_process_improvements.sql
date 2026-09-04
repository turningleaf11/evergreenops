CREATE TABLE IF NOT EXISTS public.process_improvements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bucket_id UUID REFERENCES public.process_buckets(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_review','converted','closed')),
  kind TEXT NOT NULL DEFAULT 'idea' CHECK (kind IN ('idea','pain_point','observation','improvement')),
  converted_to_task_id UUID,
  converted_to_project_id UUID,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS process_improvements_bucket_idx ON public.process_improvements(bucket_id);
CREATE INDEX IF NOT EXISTS process_improvements_status_idx ON public.process_improvements(status);

ALTER TABLE public.process_improvements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "process_improvements_select" ON public.process_improvements;
CREATE POLICY "process_improvements_select" ON public.process_improvements FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "process_improvements_insert" ON public.process_improvements;
CREATE POLICY "process_improvements_insert" ON public.process_improvements FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
DROP POLICY IF EXISTS "process_improvements_update" ON public.process_improvements;
CREATE POLICY "process_improvements_update" ON public.process_improvements FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "process_improvements_delete" ON public.process_improvements;
CREATE POLICY "process_improvements_delete" ON public.process_improvements FOR DELETE TO authenticated USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS process_improvements_set_updated ON public.process_improvements;
CREATE TRIGGER process_improvements_set_updated BEFORE UPDATE ON public.process_improvements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();;
