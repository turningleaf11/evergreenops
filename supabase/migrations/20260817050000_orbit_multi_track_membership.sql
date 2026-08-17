-- Allow one person to hold more than one active Orbit track at once (e.g. Kez
-- works DTA + DTB, Lamel works DTA + DTS). orbit_members previously enforced
-- one row per (user_id, department_id), and every Orbit member shares the
-- same program department, so that was effectively one track per person.
-- Widen it to (user_id, department_id, track) so a second row for a second
-- track is allowed, while still blocking a duplicate row for the same track.
ALTER TABLE public.orbit_members DROP CONSTRAINT IF EXISTS orbit_members_user_id_department_id_key;
ALTER TABLE public.orbit_members
  ADD CONSTRAINT orbit_members_user_id_department_id_track_key
  UNIQUE (user_id, department_id, track);
