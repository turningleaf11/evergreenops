
-- Junction table for multi-user reminder delegation
CREATE TABLE public.reminder_assignees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reminder_id UUID NOT NULL REFERENCES public.reminders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (reminder_id, user_id)
);

ALTER TABLE public.reminder_assignees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all reminder assignees"
  ON public.reminder_assignees FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Assignees can view their assignments"
  ON public.reminder_assignees FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Assignees can update their assignments"
  ON public.reminder_assignees FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Creators can manage assignees on their reminders"
  ON public.reminder_assignees FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.reminders r
      WHERE r.id = reminder_id AND r.user_id = auth.uid()
    )
  );

-- Update reminders SELECT policy to include junction table assignees
DROP POLICY IF EXISTS "Users can view own or assigned reminders" ON public.reminders;
CREATE POLICY "Users can view own or assigned reminders"
  ON public.reminders FOR SELECT
  TO public
  USING (
    auth.uid() = user_id
    OR auth.uid() = assigned_to
    OR EXISTS (
      SELECT 1 FROM public.reminder_assignees ra
      WHERE ra.reminder_id = id AND ra.user_id = auth.uid()
    )
  );

-- Add-on packs catalog
CREATE TABLE public.addon_packs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  icon TEXT DEFAULT 'Package',
  price_tier TEXT NOT NULL DEFAULT 'free',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.addon_packs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view active packs"
  ON public.addon_packs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage packs"
  ON public.addon_packs FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Workspace-level addon enablement
CREATE TABLE public.workspace_addons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  addon_id UUID NOT NULL REFERENCES public.addon_packs(id) ON DELETE CASCADE,
  enabled_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  enabled_by UUID,
  UNIQUE (workspace_id, addon_id)
);

ALTER TABLE public.workspace_addons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view workspace addons"
  ON public.workspace_addons FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage workspace addons"
  ON public.workspace_addons FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at on addon_packs
CREATE TRIGGER update_addon_packs_updated_at
  BEFORE UPDATE ON public.addon_packs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
