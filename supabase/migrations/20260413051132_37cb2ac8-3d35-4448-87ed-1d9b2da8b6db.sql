
-- Add is_primary column
ALTER TABLE public.user_roles ADD COLUMN is_primary boolean NOT NULL DEFAULT false;

-- Restore admin role and mark as primary
UPDATE public.user_roles
SET role = 'admin', is_primary = true
WHERE user_id = '87840102-3651-4574-b2d3-3a0676028c0f';

-- Protection trigger
CREATE OR REPLACE FUNCTION public.protect_primary_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_primary = true THEN
      RAISE EXCEPTION 'Cannot delete the primary admin role';
    END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.is_primary = true AND (NEW.role <> 'admin' OR NEW.is_primary = false) THEN
      RAISE EXCEPTION 'Cannot demote or unmark the primary admin';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER protect_primary_admin_trigger
BEFORE UPDATE OR DELETE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.protect_primary_admin();
