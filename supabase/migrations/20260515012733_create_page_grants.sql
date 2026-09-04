
CREATE TABLE public.page_grants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page_key TEXT NOT NULL,
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, page_key)
);

CREATE INDEX page_grants_user_idx ON public.page_grants(user_id);

ALTER TABLE public.page_grants ENABLE ROW LEVEL SECURITY;

-- Users can read their own grants; admins can read all
CREATE POLICY "Users see own grants" ON public.page_grants
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Only admins manage grants
CREATE POLICY "Admins manage grants" ON public.page_grants
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
;
