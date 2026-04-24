
CREATE TABLE public.ceo_strategic_questions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  workspace_id uuid,
  week_start_date date NOT NULL,
  question text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start_date)
);

ALTER TABLE public.ceo_strategic_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own strategic questions"
ON public.ceo_strategic_questions
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
