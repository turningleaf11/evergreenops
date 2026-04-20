-- Fix infinite recursion in reminders RLS
-- Replace the buggy SELECT policy that self-references and causes recursion via reminder_assignees

DROP POLICY IF EXISTS "Users can view own or assigned reminders" ON public.reminders;

-- Security definer helper to check assignment without triggering RLS recursion
CREATE OR REPLACE FUNCTION public.is_reminder_assignee(_reminder_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.reminder_assignees
    WHERE reminder_id = _reminder_id AND user_id = _user_id
  )
$$;

CREATE POLICY "Users can view own or assigned reminders"
ON public.reminders
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR auth.uid() = assigned_to
  OR public.is_reminder_assignee(id, auth.uid())
);