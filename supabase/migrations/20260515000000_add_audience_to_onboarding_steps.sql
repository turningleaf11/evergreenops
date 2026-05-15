ALTER TABLE public.onboarding_steps
  ADD COLUMN IF NOT EXISTS audience TEXT NOT NULL DEFAULT 'everyone'
  CHECK (audience IN ('everyone', 'admin', 'user'));
