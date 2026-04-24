-- 1. leadership_meetings
CREATE TABLE public.leadership_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  meeting_date date NOT NULL DEFAULT CURRENT_DATE,
  meeting_week date NOT NULL DEFAULT date_trunc('week', CURRENT_DATE)::date,
  status text NOT NULL DEFAULT 'draft',
  rating integer,
  overall_notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  CONSTRAINT leadership_meetings_status_chk CHECK (status IN ('draft','in_progress','completed')),
  CONSTRAINT leadership_meetings_rating_chk CHECK (rating IS NULL OR (rating BETWEEN 1 AND 10))
);

CREATE INDEX idx_leadership_meetings_workspace ON public.leadership_meetings(workspace_id);
CREATE INDEX idx_leadership_meetings_week ON public.leadership_meetings(meeting_week DESC);

ALTER TABLE public.leadership_meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view leadership meetings"
  ON public.leadership_meetings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage leadership meetings"
  ON public.leadership_meetings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Allow members to update status/rating/notes on a meeting they are participating in
CREATE POLICY "Members can update in-progress meetings"
  ON public.leadership_meetings FOR UPDATE TO authenticated
  USING (status IN ('draft','in_progress'))
  WITH CHECK (status IN ('draft','in_progress','completed'));


-- 2. meeting_agenda_items
CREATE TABLE public.meeting_agenda_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.leadership_meetings(id) ON DELETE CASCADE,
  section text NOT NULL,
  item_type text NOT NULL DEFAULT 'manual',
  title text NOT NULL,
  description text,
  reference_type text,
  reference_id uuid,
  status text NOT NULL DEFAULT 'pending',
  discussion_notes text,
  sort_order integer NOT NULL DEFAULT 0,
  added_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agenda_section_chk CHECK (section IN ('segue','scorecard','rocks','todos','issues','strategy','conclude')),
  CONSTRAINT agenda_item_type_chk CHECK (item_type IN ('auto','manual')),
  CONSTRAINT agenda_status_chk CHECK (status IN ('pending','discussed','resolved','tabled'))
);

CREATE INDEX idx_agenda_meeting ON public.meeting_agenda_items(meeting_id, sort_order);

ALTER TABLE public.meeting_agenda_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view agenda items"
  ON public.meeting_agenda_items FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage agenda items"
  ON public.meeting_agenda_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Members can add discussion notes (UPDATE) on agenda items during a meeting
CREATE POLICY "Members can update discussion notes"
  ON public.meeting_agenda_items FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);


-- 3. leadership_meeting_action_items (separate from Fathom meeting_action_items)
CREATE TABLE public.leadership_meeting_action_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.leadership_meetings(id) ON DELETE CASCADE,
  agenda_item_id uuid REFERENCES public.meeting_agenda_items(id) ON DELETE SET NULL,
  title text NOT NULL,
  assigned_to uuid NOT NULL,
  due_date date,
  converted_to_task_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_lmai_meeting ON public.leadership_meeting_action_items(meeting_id);
CREATE INDEX idx_lmai_assignee ON public.leadership_meeting_action_items(assigned_to);

ALTER TABLE public.leadership_meeting_action_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view leadership action items"
  ON public.leadership_meeting_action_items FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can create leadership action items"
  ON public.leadership_meeting_action_items FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can update leadership action items"
  ON public.leadership_meeting_action_items FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Admins delete leadership action items"
  ON public.leadership_meeting_action_items FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR auth.uid() = assigned_to);