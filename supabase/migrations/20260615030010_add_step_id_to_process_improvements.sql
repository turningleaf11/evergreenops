ALTER TABLE public.process_improvements ADD COLUMN IF NOT EXISTS step_id UUID REFERENCES public.process_buckets(id) ON DELETE SET NULL;;
