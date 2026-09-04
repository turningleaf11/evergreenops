-- Role-based access for sync channels. A channel can declare itself "for_role"
-- and any user with that role automatically has access — no explicit
-- sync_channel_members row needed. Solves the "new hire silently locked out
-- of team channels" problem.
--
-- for_role values:
--   NULL     → behaves the old way (explicit membership only)
--   'leader' → all leaders + admins have access
--   'admin'  → only admins
--   'all'    → all workspace users
--
-- Explicit membership still works for custom groups and DMs — and even on
-- role-based channels (so we can add a non-leader as a guest if needed).

ALTER TABLE public.sync_channels
  ADD COLUMN IF NOT EXISTS for_role TEXT
  CHECK (for_role IS NULL OR for_role IN ('leader','admin','all'));

CREATE INDEX IF NOT EXISTS idx_sync_channels_for_role ON public.sync_channels(for_role)
  WHERE for_role IS NOT NULL;

-- Update is_sync_member: a user "is a member" of a channel if EITHER
--   (a) they have an explicit row in sync_channel_members, OR
--   (b) the channel's for_role matches a role the user has.
CREATE OR REPLACE FUNCTION public.is_sync_member(_channel_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    -- Explicit membership (custom groups, DMs, guests)
    EXISTS (
      SELECT 1 FROM public.sync_channel_members
      WHERE channel_id = _channel_id AND user_id = _user_id
    )
    OR
    -- Role-based access (team channels — derived, no rows needed)
    EXISTS (
      SELECT 1
      FROM public.sync_channels c
      LEFT JOIN public.profiles p ON p.user_id = _user_id
      WHERE c.id = _channel_id
        AND (
          (c.for_role = 'all')
          OR
          (c.for_role = 'admin' AND public.has_role(_user_id, 'admin'::app_role))
          OR
          (c.for_role = 'leader' AND (
            COALESCE(p.is_leader, false) = true
            OR public.has_role(_user_id, 'admin'::app_role)
          ))
        )
    );
$function$;

-- Update the SELECT policy on sync_channels so role-based channels also show up
-- in the channel list for users who qualify.
DROP POLICY IF EXISTS "sync_channels_select_members" ON public.sync_channels;
CREATE POLICY "sync_channels_select_members" ON public.sync_channels
  FOR SELECT TO authenticated
  USING (public.is_sync_member(id, auth.uid()));

-- Mark "All Leadership" as a leader channel. Now anyone you flip to is_leader=true
-- (or grant admin) gets access instantly without any membership bookkeeping.
UPDATE public.sync_channels
SET for_role = 'leader'
WHERE id = 'f3d8c0f0-e761-475c-b5b8-7774ce18ebeb';;
