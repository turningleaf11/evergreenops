-- 1. Team members table
CREATE TABLE public.deal_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member',
  added_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (deal_id, user_id)
);

CREATE INDEX idx_deal_team_members_deal ON public.deal_team_members(deal_id);
CREATE INDEX idx_deal_team_members_user ON public.deal_team_members(user_id);

ALTER TABLE public.deal_team_members ENABLE ROW LEVEL SECURITY;

-- Helper: is user a team member on a deal?
CREATE OR REPLACE FUNCTION public.is_deal_team_member(_deal_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.deal_team_members
    WHERE deal_id = _deal_id AND user_id = _user_id
  )
$$;

-- Helper: can user access a deal (owner/creator/team/admin)?
CREATE OR REPLACE FUNCTION public.can_access_deal(_deal_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.deals d
      WHERE d.id = _deal_id
        AND (d.owner_id = _user_id OR d.created_by = _user_id)
    )
    OR public.is_deal_team_member(_deal_id, _user_id)
$$;

-- Helper: can user access a contact (owner/creator/admin OR via a deal they can access)?
CREATE OR REPLACE FUNCTION public.can_access_contact(_contact_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.contacts c
      WHERE c.id = _contact_id
        AND (c.owner_id = _user_id OR c.created_by = _user_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.deals d
      WHERE d.primary_contact_id = _contact_id
        AND (
          d.owner_id = _user_id
          OR d.created_by = _user_id
          OR public.is_deal_team_member(d.id, _user_id)
        )
    )
$$;

-- Policies for deal_team_members
CREATE POLICY "View team membership for accessible deals"
  ON public.deal_team_members FOR SELECT
  TO authenticated
  USING (public.can_access_deal(deal_id, auth.uid()));

CREATE POLICY "Owners/admins manage team members"
  ON public.deal_team_members FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.deals d
      WHERE d.id = deal_id
        AND (d.owner_id = auth.uid() OR d.created_by = auth.uid())
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.deals d
      WHERE d.id = deal_id
        AND (d.owner_id = auth.uid() OR d.created_by = auth.uid())
    )
  );

-- 2. Tighten contacts SELECT policy
DROP POLICY IF EXISTS "Authenticated view contacts" ON public.contacts;
CREATE POLICY "View accessible contacts"
  ON public.contacts FOR SELECT
  TO authenticated
  USING (public.can_access_contact(id, auth.uid()));

-- 3. Tighten deals SELECT + allow team members to update
DROP POLICY IF EXISTS "Authenticated view deals" ON public.deals;
CREATE POLICY "View accessible deals"
  ON public.deals FOR SELECT
  TO authenticated
  USING (public.can_access_deal(id, auth.uid()));

DROP POLICY IF EXISTS "Owners update deals" ON public.deals;
CREATE POLICY "Owners and team update deals"
  ON public.deals FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = owner_id
    OR auth.uid() = created_by
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_deal_team_member(id, auth.uid())
  );

-- 4. Auto-sync contact owner from deal owner when contact has no owner
CREATE OR REPLACE FUNCTION public.deals_sync_contact_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.primary_contact_id IS NOT NULL AND NEW.owner_id IS NOT NULL THEN
    UPDATE public.contacts
       SET owner_id = NEW.owner_id
     WHERE id = NEW.primary_contact_id
       AND owner_id IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deals_sync_contact_owner ON public.deals;
CREATE TRIGGER trg_deals_sync_contact_owner
AFTER INSERT OR UPDATE OF owner_id, primary_contact_id ON public.deals
FOR EACH ROW
EXECUTE FUNCTION public.deals_sync_contact_owner();