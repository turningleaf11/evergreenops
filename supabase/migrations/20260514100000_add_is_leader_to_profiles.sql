ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_leader BOOLEAN NOT NULL DEFAULT false;

-- Helper function for RLS / app code to check leader status
CREATE OR REPLACE FUNCTION public.is_leader(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT is_leader FROM public.profiles WHERE user_id = _user_id), false);
$$;
