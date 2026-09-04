
-- Individual call disposition events received from GHL workflows.
-- Aggregated by orbit-sync-performance into weekly snapshots.
CREATE TABLE public.orbit_call_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ghl_user_id TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  disposition TEXT,
  contact_id TEXT,
  duration_seconds INT,
  raw JSONB,
  -- Idempotency key: GHL workflows can retry. Generated as a hash of (ghl_user_id + contact_id + occurred_at)
  -- to prevent duplicate inserts on workflow retries.
  dedupe_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX orbit_call_events_user_time_idx ON public.orbit_call_events (ghl_user_id, occurred_at DESC);
CREATE INDEX orbit_call_events_disposition_idx ON public.orbit_call_events (disposition);

ALTER TABLE public.orbit_call_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage call events"
ON public.orbit_call_events FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Members see own call events"
ON public.orbit_call_events FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.orbit_members om
   WHERE om.ghl_user_id = orbit_call_events.ghl_user_id AND om.user_id = auth.uid()
));

-- Maps a disposition string to a category (case-insensitive lookup table).
-- 'connected' counts toward conversations; 'attempt' is dial-only (calls_made).
CREATE TABLE public.orbit_disposition_map (
  disposition TEXT PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('connected', 'attempt', 'ignore')),
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.orbit_disposition_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read disposition map"
ON public.orbit_disposition_map FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage disposition map"
ON public.orbit_disposition_map FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed common dispositions per Autumn's GHL — How to Work Your Leads doc.
-- These can be edited/extended via admin UI later.
INSERT INTO public.orbit_disposition_map (disposition, category, notes) VALUES
  ('Connected – Seller',     'connected', 'Spoke directly with the property owner'),
  ('Connected - Seller',     'connected', 'En-dash variant'),
  ('Connected – Gatekeeper', 'connected', 'Spoke with someone other than the owner'),
  ('Connected - Gatekeeper', 'connected', 'En-dash variant'),
  ('Appointment Set',        'connected', 'Locked in time with Acq Manager — counted as a conversation too'),
  ('Follow Up Requested',    'connected', 'They asked you to call back'),
  ('No Answer',              'attempt',   'Phone rang, no pickup'),
  ('Left Voicemail',         'attempt',   'No answer, left VM'),
  ('Call Failed',            'attempt',   'Technical failure'),
  ('Wrong Number',           'ignore',    'Not the right contact'),
  ('Number Disconnected',    'ignore',    'Dead line'),
  ('Do Not Call Requested',  'ignore',    'DNC — log + stop')
ON CONFLICT (disposition) DO NOTHING;
;
