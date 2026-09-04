
-- Only the FIRST user in the workspace should be is_primary=true.
-- The old trigger marked every new user as primary, which broke invite flows
-- (the UI hid delete/resend buttons because the user looked like a primary admin).

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

  -- First user in the system becomes the primary admin; everyone else is a regular user.
  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles WHERE is_primary = true) INTO is_first_user;

  IF is_first_user THEN
    INSERT INTO public.user_roles (user_id, role, is_primary) VALUES (NEW.id, 'admin', true);
  ELSE
    INSERT INTO public.user_roles (user_id, role, is_primary) VALUES (NEW.id, 'user', false);
  END IF;

  RETURN NEW;
END;
$function$;

-- Backfill: anyone OTHER than the true workspace primary admin should have is_primary=false.
-- The original primary is the oldest user with is_primary=true.
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
;
