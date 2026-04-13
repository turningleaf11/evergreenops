
-- Add new columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS reports_to uuid;

-- Create team_notes table
CREATE TABLE public.team_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_user_id uuid NOT NULL,
  author_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'one_on_one',
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.team_notes ENABLE ROW LEVEL SECURITY;

-- Admins can do everything with team notes
CREATE POLICY "Admins can manage team notes"
  ON public.team_notes FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Users can view notes about themselves
CREATE POLICY "Users can view notes about themselves"
  ON public.team_notes FOR SELECT
  TO authenticated
  USING (auth.uid() = subject_user_id);

-- Trigger for updated_at
CREATE TRIGGER update_team_notes_updated_at
  BEFORE UPDATE ON public.team_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
