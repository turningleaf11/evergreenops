CREATE TABLE public.ceo_scratch_pad (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  content text NOT NULL DEFAULT '',
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.ceo_scratch_pad ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage their scratch pad"
ON public.ceo_scratch_pad
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) AND auth.uid() = user_id)
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND auth.uid() = user_id);