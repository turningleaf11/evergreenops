CREATE TABLE public.ceo_weekly_priorities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  week_start_date date NOT NULL,
  top_priority text NOT NULL DEFAULT '',
  second_priority text NOT NULL DEFAULT '',
  third_priority text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, week_start_date)
);

ALTER TABLE public.ceo_weekly_priorities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own weekly priorities"
ON public.ceo_weekly_priorities
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins view all weekly priorities"
ON public.ceo_weekly_priorities
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_ceo_weekly_priorities_updated_at
BEFORE UPDATE ON public.ceo_weekly_priorities
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();