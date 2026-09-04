
-- Insert Evergreen verticals (idempotent)
INSERT INTO public.process_verticals (workspace_id, name, description, color, icon, sort_order, visibility, created_by)
VALUES
  ('a8938ed0-9c4e-4d42-b874-593b4b3c90a9', 'Wholesale', 'End-to-end seller lead generation, acquisitions, and dispositions pipeline', '#16a34a', 'trending-up', 1, 'workspace', (SELECT id FROM auth.users LIMIT 1)),
  ('a8938ed0-9c4e-4d42-b874-593b4b3c90a9', 'Portfolio', 'Buy-and-hold acquisitions, underwriting, and asset management', '#2563eb', 'building-2', 2, 'workspace', (SELECT id FROM auth.users LIMIT 1)),
  ('a8938ed0-9c4e-4d42-b874-593b4b3c90a9', 'Dispositions', 'JV partnerships, buyer network, and deal assignment', '#dc2626', 'handshake', 3, 'workspace', (SELECT id FROM auth.users LIMIT 1)),
  ('a8938ed0-9c4e-4d42-b874-593b4b3c90a9', 'Operations', 'Team processes, Orbit program, and admin/ops systems', '#7c3aed', 'settings', 4, 'workspace', (SELECT id FROM auth.users LIMIT 1)),
  ('a8938ed0-9c4e-4d42-b874-593b4b3c90a9', 'Design', 'Design practice — client projects and creative services', '#db2777', 'palette', 5, 'workspace', (SELECT id FROM auth.users LIMIT 1))
ON CONFLICT DO NOTHING;

-- Link existing top-level area buckets to their verticals
UPDATE public.process_buckets SET vertical_id = (
  SELECT id FROM public.process_verticals
  WHERE workspace_id = 'a8938ed0-9c4e-4d42-b874-593b4b3c90a9' AND name = 'Wholesale'
)
WHERE workspace_id = 'a8938ed0-9c4e-4d42-b874-593b4b3c90a9'
  AND slug IN ('lead-gen', 'acquisitions', 'lg-seo-partner', 'lg-ghl-wf', 'lg-appt-outcome', 'lg-mls-leads', 'lg-import-ghl', 'lg-seo-wf', 'lg-jr-acq', 'lg-lists');

UPDATE public.process_buckets SET vertical_id = (
  SELECT id FROM public.process_verticals
  WHERE workspace_id = 'a8938ed0-9c4e-4d42-b874-593b4b3c90a9' AND name = 'Portfolio'
)
WHERE workspace_id = 'a8938ed0-9c4e-4d42-b874-593b4b3c90a9'
  AND slug IN ('portfolio', 'port-intake', 'port-req-info', 'port-t1u', 'port-offer', 'port-fu1', 'port-fu3', 'port-fu7', 'port-close');

UPDATE public.process_buckets SET vertical_id = (
  SELECT id FROM public.process_verticals
  WHERE workspace_id = 'a8938ed0-9c4e-4d42-b874-593b4b3c90a9' AND name = 'Dispositions'
)
WHERE workspace_id = 'a8938ed0-9c4e-4d42-b874-593b4b3c90a9'
  AND slug IN ('dispo', 'dispo-acq-deal', 'dispo-jv-web', 'dispo-route', 'dispo-validator', 'dispo-buyer', 'dispo-jv-agree', 'dispo-close');

UPDATE public.process_buckets SET vertical_id = (
  SELECT id FROM public.process_verticals
  WHERE workspace_id = 'a8938ed0-9c4e-4d42-b874-593b4b3c90a9' AND name = 'Operations'
)
WHERE workspace_id = 'a8938ed0-9c4e-4d42-b874-593b4b3c90a9'
  AND slug IN ('operations', 'ops-orbit-form', 'ops-orbit-wf', 'ops-orbit-opp', 'ops-orbit-train', 'ops-orbit-call', 'ops-orbit-submit', 'orbit-program-1778693918705');

UPDATE public.process_buckets SET vertical_id = (
  SELECT id FROM public.process_verticals
  WHERE workspace_id = 'a8938ed0-9c4e-4d42-b874-593b4b3c90a9' AND name = 'Design'
)
WHERE workspace_id = 'a8938ed0-9c4e-4d42-b874-593b4b3c90a9'
  AND slug IN ('design', 'des-inquiry', 'des-scope', 'des-brief', 'des-execution', 'des-handoff');

-- Also assign acquisitions area and its children to Wholesale
UPDATE public.process_buckets SET vertical_id = (
  SELECT id FROM public.process_verticals
  WHERE workspace_id = 'a8938ed0-9c4e-4d42-b874-593b4b3c90a9' AND name = 'Wholesale'
)
WHERE workspace_id = 'a8938ed0-9c4e-4d42-b874-593b4b3c90a9'
  AND slug IN ('acquisitions', 'acq-contact', 'acq-assign', 'acq-seller-call', 'acq-appt-book', 'acq-offer-gen', 'acq-followup', 'acq-accepted', 'acq-agreement');
;
