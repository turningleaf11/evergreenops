
-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('files', 'files', true);

CREATE POLICY "Authenticated users can upload files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'files');
CREATE POLICY "Anyone can view files" ON storage.objects FOR SELECT USING (bucket_id = 'files');
CREATE POLICY "Uploaders can delete their files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'files' AND (auth.uid())::text = (storage.foldername(name))[1]);

-- Department pinboard table
CREATE TABLE public.department_pinboard (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'link',
  title text NOT NULL,
  url text,
  description text DEFAULT '',
  icon text DEFAULT 'Link',
  sort_order integer DEFAULT 0,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.department_pinboard ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view pins" ON public.department_pinboard FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create pins" ON public.department_pinboard FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admins can manage all pins" ON public.department_pinboard FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Creators can update their pins" ON public.department_pinboard FOR UPDATE TO authenticated USING (auth.uid() = created_by);
CREATE POLICY "Creators can delete their pins" ON public.department_pinboard FOR DELETE TO authenticated USING (auth.uid() = created_by);

CREATE TRIGGER update_department_pinboard_updated_at
BEFORE UPDATE ON public.department_pinboard
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
