-- Daily priorities for CEO Today tab (per-user, per-day)
CREATE TABLE public.daily_priorities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  priority_date DATE NOT NULL,
  slot SMALLINT NOT NULL CHECK (slot IN (1, 2, 3)),
  text TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, priority_date, slot)
);

ALTER TABLE public.daily_priorities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own daily priorities"
  ON public.daily_priorities
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_daily_priorities_updated_at
  BEFORE UPDATE ON public.daily_priorities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_daily_priorities_user_date ON public.daily_priorities (user_id, priority_date);

-- Cache for latest AI daily briefing per user
CREATE TABLE public.daily_briefings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  briefing_date DATE NOT NULL,
  bullets JSONB NOT NULL DEFAULT '[]'::jsonb,
  focus TEXT NOT NULL DEFAULT '',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, briefing_date)
);

ALTER TABLE public.daily_briefings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own daily briefing"
  ON public.daily_briefings
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_daily_briefings_updated_at
  BEFORE UPDATE ON public.daily_briefings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_daily_briefings_user_date ON public.daily_briefings (user_id, briefing_date DESC);