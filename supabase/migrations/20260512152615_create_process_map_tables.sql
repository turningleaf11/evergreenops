
CREATE TABLE IF NOT EXISTS public.process_buckets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  bucket_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.process_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id UUID NOT NULL REFERENCES public.process_buckets(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  step_order INTEGER NOT NULL DEFAULT 0,
  is_complete BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bucket_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id UUID NOT NULL REFERENCES public.process_buckets(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.process_buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bucket_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "all authenticated users can manage process_buckets"
  ON public.process_buckets FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "all authenticated users can manage process_steps"
  ON public.process_steps FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "all authenticated users can manage bucket_projects"
  ON public.bucket_projects FOR ALL USING (auth.uid() IS NOT NULL);

INSERT INTO public.process_buckets (slug, name, bucket_order) VALUES
  ('leads',   'Leads',      1),
  ('followup','Follow Up',  2),
  ('offer',   'Offer',      3),
  ('escrow',  'Escrow',     4),
  ('dispo',   'Dispo',      5),
  ('mngt',    'Mngt',       6)
ON CONFLICT (slug) DO NOTHING;
;
