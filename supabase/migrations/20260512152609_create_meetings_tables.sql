
CREATE TABLE IF NOT EXISTS public.meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  fathom_meeting_id TEXT UNIQUE,
  recording_id TEXT,
  title TEXT NOT NULL DEFAULT 'Untitled meeting',
  started_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  recording_url TEXT,
  fathom_url TEXT,
  transcript_text TEXT,
  summary TEXT,
  ai_insights TEXT,
  key_decisions TEXT[] NOT NULL DEFAULT '{}',
  action_items JSONB NOT NULL DEFAULT '[]',
  attendees JSONB NOT NULL DEFAULT '[]',
  sentiment TEXT,
  host_email TEXT,
  has_external_participants BOOLEAN NOT NULL DEFAULT false,
  raw_payload JSONB,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.meeting_action_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  assignee_email TEXT,
  assignee_user_id UUID REFERENCES auth.users(id),
  completed BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  converted_task_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_action_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace members can manage meetings"
  ON public.meetings FOR ALL
  USING (workspace_id IN (SELECT workspace_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "meeting action items follow meeting access"
  ON public.meeting_action_items FOR ALL
  USING (meeting_id IN (SELECT id FROM public.meetings WHERE workspace_id IN (SELECT workspace_id FROM public.profiles WHERE user_id = auth.uid())));
;
