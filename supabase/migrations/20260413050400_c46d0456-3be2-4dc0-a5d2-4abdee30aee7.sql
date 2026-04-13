
-- Activity events table for Phase 4
CREATE TABLE public.activity_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id UUID,
  actor_name TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  entity_title TEXT,
  department_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view activity"
  ON public.activity_events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create activity"
  ON public.activity_events FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can manage activity"
  ON public.activity_events FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_events;
