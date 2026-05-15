ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS is_program BOOLEAN NOT NULL DEFAULT false;
UPDATE public.departments SET is_program = true WHERE name ILIKE 'orbit%';

CREATE TABLE IF NOT EXISTS public.orbit_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  track TEXT NOT NULL CHECK (track IN ('dts','dta','deal_scout','underwriting','d4')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','on_notice','graduated','removed')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  track_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  graduated_at TIMESTAMPTZ,
  removed_at TIMESTAMPTZ,
  removal_reason TEXT,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, department_id)
);
CREATE INDEX IF NOT EXISTS orbit_members_dept_status_idx ON public.orbit_members (department_id, status);
CREATE INDEX IF NOT EXISTS orbit_members_user_idx ON public.orbit_members (user_id);
ALTER TABLE public.orbit_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage orbit members" ON public.orbit_members;
CREATE POLICY "Admins manage orbit members" ON public.orbit_members FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users see own orbit membership" ON public.orbit_members;
CREATE POLICY "Users see own orbit membership" ON public.orbit_members FOR SELECT TO authenticated
USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_orbit_members_updated ON public.orbit_members;
CREATE TRIGGER trg_orbit_members_updated BEFORE UPDATE ON public.orbit_members
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.orbit_setup_checklist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES public.orbit_members(id) ON DELETE CASCADE,
  item_key TEXT NOT NULL,
  label TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  done BOOLEAN NOT NULL DEFAULT false,
  done_at TIMESTAMPTZ,
  done_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (member_id, item_key)
);
CREATE INDEX IF NOT EXISTS orbit_checklist_member_idx ON public.orbit_setup_checklist (member_id);
ALTER TABLE public.orbit_setup_checklist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage orbit checklists" ON public.orbit_setup_checklist;
CREATE POLICY "Admins manage orbit checklists" ON public.orbit_setup_checklist FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.orbit_strikes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES public.orbit_members(id) ON DELETE CASCADE,
  strike_number INT NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  issued_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  issued_by_name TEXT,
  reason TEXT NOT NULL DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (member_id, strike_number)
);
CREATE INDEX IF NOT EXISTS orbit_strikes_member_idx ON public.orbit_strikes (member_id, strike_number);
ALTER TABLE public.orbit_strikes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage orbit strikes" ON public.orbit_strikes;
CREATE POLICY "Admins manage orbit strikes" ON public.orbit_strikes FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Members can see own strikes" ON public.orbit_strikes;
CREATE POLICY "Members can see own strikes" ON public.orbit_strikes FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.orbit_members om WHERE om.id = orbit_strikes.member_id AND om.user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.orbit_performance_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES public.orbit_members(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  calls_made INT DEFAULT 0,
  appointments_set INT DEFAULT 0,
  leads_qualified INT DEFAULT 0,
  deals_closed INT DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','ghl')),
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (member_id, snapshot_date)
);
CREATE INDEX IF NOT EXISTS orbit_perf_member_date_idx ON public.orbit_performance_snapshots (member_id, snapshot_date DESC);
ALTER TABLE public.orbit_performance_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage orbit performance" ON public.orbit_performance_snapshots;
CREATE POLICY "Admins manage orbit performance" ON public.orbit_performance_snapshots FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Members can see own performance" ON public.orbit_performance_snapshots;
CREATE POLICY "Members can see own performance" ON public.orbit_performance_snapshots FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.orbit_members om WHERE om.id = orbit_performance_snapshots.member_id AND om.user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.orbit_seed_checklist()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.orbit_setup_checklist (member_id, item_key, label, sort_order) VALUES
    (NEW.id, 'ghl_account',  'GHL account created',   1),
    (NEW.id, 'phone_number', 'Phone number assigned', 2),
    (NEW.id, 'email',        'Email account set up',  3),
    (NEW.id, 'evergreenops', 'EvergreenOps access',   4),
    (NEW.id, 'discord_role', 'Discord role granted',  5);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orbit_seed_checklist ON public.orbit_members;
CREATE TRIGGER trg_orbit_seed_checklist AFTER INSERT ON public.orbit_members
FOR EACH ROW EXECUTE FUNCTION public.orbit_seed_checklist();
