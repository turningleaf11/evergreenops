
-- Widget preferences per user
CREATE TABLE public.widget_preferences (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  widget_id text NOT NULL,
  visible boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, widget_id)
);

ALTER TABLE public.widget_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own widget prefs"
ON public.widget_preferences FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own widget prefs"
ON public.widget_preferences FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own widget prefs"
ON public.widget_preferences FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own widget prefs"
ON public.widget_preferences FOR DELETE
USING (auth.uid() = user_id);

-- Admin-managed widget defaults
CREATE TABLE public.widget_defaults (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  widget_id text NOT NULL UNIQUE,
  visible boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.widget_defaults ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated can view widget defaults"
ON public.widget_defaults FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage widget defaults"
ON public.widget_defaults FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
