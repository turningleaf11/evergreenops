-- ============================================
-- CADENCES (Operating Rhythms)
-- ============================================
CREATE TABLE public.cadences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  owner_id UUID,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  sop_doc_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  schedule_type TEXT NOT NULL DEFAULT 'weekly', -- daily | weekly | monthly | custom
  schedule_config JSONB NOT NULL DEFAULT '{}'::jsonb, -- { day_of_week, day_of_month, cron, time }
  task_template JSONB NOT NULL DEFAULT '{}'::jsonb, -- { title, priority, tags, est_minutes }
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cadences_workspace ON public.cadences(workspace_id);
CREATE INDEX idx_cadences_owner ON public.cadences(owner_id);
CREATE INDEX idx_cadences_active ON public.cadences(is_active);

ALTER TABLE public.cadences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view cadences"
  ON public.cadences FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage all cadences"
  ON public.cadences FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners manage their cadences"
  ON public.cadences FOR ALL TO authenticated
  USING (auth.uid() = owner_id OR auth.uid() = created_by)
  WITH CHECK (auth.uid() = owner_id OR auth.uid() = created_by);

CREATE TRIGGER update_cadences_updated_at
  BEFORE UPDATE ON public.cadences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.cadence_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cadence_id UUID NOT NULL REFERENCES public.cadences(id) ON DELETE CASCADE,
  generated_task_id UUID,
  due_date DATE NOT NULL,
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | completed | missed
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(cadence_id, due_date)
);

CREATE INDEX idx_cadence_runs_cadence ON public.cadence_runs(cadence_id);
CREATE INDEX idx_cadence_runs_due ON public.cadence_runs(due_date);

ALTER TABLE public.cadence_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view cadence runs"
  ON public.cadence_runs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage all cadence runs"
  ON public.cadence_runs FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners manage their cadence runs"
  ON public.cadence_runs FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.cadences c WHERE c.id = cadence_id AND c.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.cadences c WHERE c.id = cadence_id AND c.owner_id = auth.uid()));

-- ============================================
-- WORKSPACE HOLIDAYS
-- ============================================
CREATE TABLE public.workspace_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  date DATE NOT NULL,
  is_recurring BOOLEAN NOT NULL DEFAULT true,
  color TEXT NOT NULL DEFAULT '#f59e0b',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_holidays_workspace ON public.workspace_holidays(workspace_id);
CREATE INDEX idx_holidays_date ON public.workspace_holidays(date);

ALTER TABLE public.workspace_holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view holidays"
  ON public.workspace_holidays FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage holidays"
  ON public.workspace_holidays FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_workspace_holidays_updated_at
  BEFORE UPDATE ON public.workspace_holidays
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- MEETINGS (Fathom integration)
-- ============================================
CREATE TABLE public.meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  fathom_meeting_id TEXT UNIQUE,
  title TEXT NOT NULL DEFAULT 'Untitled meeting',
  started_at TIMESTAMPTZ,
  duration_seconds INTEGER DEFAULT 0,
  recording_url TEXT,
  transcript_text TEXT,
  summary TEXT,
  host_email TEXT,
  attendees JSONB NOT NULL DEFAULT '[]'::jsonb,
  raw_payload JSONB,
  synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_meetings_workspace ON public.meetings(workspace_id);
CREATE INDEX idx_meetings_started ON public.meetings(started_at DESC);
CREATE INDEX idx_meetings_fathom ON public.meetings(fathom_meeting_id);

ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view meetings"
  ON public.meetings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage all meetings"
  ON public.meetings FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_meetings_updated_at
  BEFORE UPDATE ON public.meetings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.meeting_action_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  assignee_email TEXT,
  assignee_user_id UUID,
  converted_task_id UUID,
  completed BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_action_items_meeting ON public.meeting_action_items(meeting_id);
CREATE INDEX idx_action_items_assignee ON public.meeting_action_items(assignee_user_id);

ALTER TABLE public.meeting_action_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view action items"
  ON public.meeting_action_items FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage all action items"
  ON public.meeting_action_items FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Assignees can update own action items"
  ON public.meeting_action_items FOR UPDATE TO authenticated
  USING (auth.uid() = assignee_user_id);

CREATE POLICY "Authenticated can create action items"
  ON public.meeting_action_items FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE TRIGGER update_action_items_updated_at
  BEFORE UPDATE ON public.meeting_action_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();