
CREATE TABLE public.announcement_acknowledgments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  announcement_id uuid NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(announcement_id, user_id)
);

ALTER TABLE public.announcement_acknowledgments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view acknowledgments"
ON public.announcement_acknowledgments FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can acknowledge announcements"
ON public.announcement_acknowledgments FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);
