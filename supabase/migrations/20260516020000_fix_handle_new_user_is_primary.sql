-- The old handle_new_user trigger marked EVERY new user as is_primary=true.
-- That was fine when there was only one user (the workspace creator) but breaks
-- the invite flow — invited users showed up as "Primary Admin" in the UI, which
-- hid the delete/resend action buttons and prevented anyone from being removed.
--
-- Fix: only the FIRST user in the system gets is_primary=true. Everyone else is
-- a regular user. The first user also becomes admin (so the workspace has at least
-- one admin); invited users default to 'user' role.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  ws_id uuid;
  is_first_user boolean;
BEGIN
  SELECT id INTO ws_id FROM public.workspaces ORDER BY created_at ASC LIMIT 1;

  INSERT INTO public.profiles (user_id, full_name, avatar_url, workspace_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
    ws_id
  );

  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles WHERE is_primary = true) INTO is_first_user;

  IF is_first_user THEN
    INSERT INTO public.user_roles (user_id, role, is_primary) VALUES (NEW.id, 'admin', true);
  ELSE
    INSERT INTO public.user_roles (user_id, role, is_primary) VALUES (NEW.id, 'user', false);
  END IF;

  RETURN NEW;
END;
$function$;

-- One-time backfill: demote anyone marked is_primary=true except the true workspace primary
-- (the oldest one — which is the workspace creator).
WITH true_primary AS (
  SELECT user_id FROM public.user_roles
  WHERE is_primary = true
  ORDER BY id
  LIMIT 1
)
UPDATE public.user_roles
SET is_primary = false
WHERE is_primary = true
  AND user_id NOT IN (SELECT user_id FROM true_primary);
