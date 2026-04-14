-- Add new columns to issues table
ALTER TABLE public.issues
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS assigned_to uuid,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';

-- Allow assigned users to update issues assigned to them
CREATE POLICY "Assigned users can update their issues"
  ON public.issues
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = assigned_to);