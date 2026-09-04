
-- ── Lead Generation subprocess ─────────────────────────────────────────────
WITH lg AS (SELECT id FROM process_buckets WHERE slug = 'lead-gen')
INSERT INTO process_buckets (slug, name, description, color, position_x, position_y, bucket_order, parent_id, node_type) 
SELECT slug, name, description, color, position_x, position_y, bucket_order, (SELECT id FROM lg), node_type FROM (VALUES
  ('lg-mls-leads',     'MLS DTA Leads',               'Active MLS / DTA list leads',                         '#10b981', 80,  80,  1, 'source'),
  ('lg-lists',         'Lists (Dealmachine)',           'Purchased/built lists imported via Dealmachine',      '#10b981', 80,  240, 2, 'source'),
  ('lg-seo-partner',   'SEO Partner (Steve D)',         'Inbound SEO leads processed in ClickUp',              '#10b981', 80,  400, 3, 'source'),
  ('lg-import-ghl',    'Import to GHL',                 'Leads imported into GoHighLevel CRM',                 '#059669', 380, 240, 4, 'process'),
  ('lg-ghl-wf',        'GHL Workflow Triggered',        'OfferRocket WF or Imported Leads WF fires; assigns to Jr. Acq via round-robin', '#059669', 650, 160, 5, 'process'),
  ('lg-seo-wf',        'Alex SEO Qualify WF',           'Prevents duplicate contacts; creates Opportunity in acquisition pipeline', '#059669', 650, 400, 6, 'process'),
  ('lg-jr-acq',        'Jr. Acq Review & Qualify',      'Jr. Acq nurtures contact; qualifies interest',        '#047857', 920, 240, 7, 'process'),
  ('lg-appt-outcome',  'Appt Set → Create Opportunity', 'Qualified lead → Opportunity created; moves to Acquisitions pipeline', '#047857', 1160, 240, 8, 'outcome')
) AS v(slug, name, description, color, position_x, position_y, bucket_order, node_type);

-- ── Acquisitions subprocess ────────────────────────────────────────────────
WITH acq AS (SELECT id FROM process_buckets WHERE slug = 'acquisitions')
INSERT INTO process_buckets (slug, name, description, color, position_x, position_y, bucket_order, parent_id, node_type)
SELECT slug, name, description, color, position_x, position_y, bucket_order, (SELECT id FROM acq), node_type FROM (VALUES
  ('acq-contact',     'Contact Created in GHL',        'Contact record created; no duplicates (Alex WF)',     '#6366f1', 80,  150, 1, 'process'),
  ('acq-assign',      'Assign to Jr. Acq',             'Round-robin assignment to junior acquisitions rep',   '#6366f1', 330, 150, 2, 'process'),
  ('acq-seller-call', 'Seller Call / Qualification',   'Jr. Acq handles initial seller call; qualifies deal', '#4f46e5', 580, 80,  3, 'process'),
  ('acq-appt-book',   'Appointment Booking',           'Ava AI bot confirms/reschedules 30 min before; GHL calendar round-robin', '#4f46e5', 580, 240, 4, 'process'),
  ('acq-offer-gen',   'Offer Generation (Offer Rocket)','Bulk offer sent to agents via Offer Rocket + GHL + Zapier', '#4338ca', 830, 80,  5, 'process'),
  ('acq-followup',    'Offer Follow-Up',               'Follow-up sequence if no response after offer sent',  '#4338ca', 830, 240, 6, 'process'),
  ('acq-accepted',    'Offer Accepted',                'Seller accepts offer; move to next stage',            '#3730a3', 1080, 150, 7, 'outcome'),
  ('acq-agreement',   'Send Agreement',                'Purchase agreement drafted and sent for signature',   '#3730a3', 1330, 150, 8, 'outcome')
) AS v(slug, name, description, color, position_x, position_y, bucket_order, node_type);

-- ── Dispo subprocess ───────────────────────────────────────────────────────
WITH dp AS (SELECT id FROM process_buckets WHERE slug = 'dispo')
INSERT INTO process_buckets (slug, name, description, color, position_x, position_y, bucket_order, parent_id, node_type)
SELECT slug, name, description, color, position_x, position_y, bucket_order, (SELECT id FROM dp), node_type FROM (VALUES
  ('dispo-acq-deal',   'Deal from Acquisitions',       'Lead Manager flags contact as Wholesaler → moves to Dispo - JV Deals pipeline', '#f59e0b', 80,  80,  1, 'source'),
  ('dispo-jv-web',     'JV via Website Form',          'Wholesaler submits JV form at evergreenreventures.com/jv-with-us', '#f59e0b', 80,  280, 2, 'source'),
  ('dispo-route',      'Route & Deal ID Assignment',   'GHL workflow assigns custom Deal ID to match Deal Validator results', '#d97706', 350, 180, 3, 'process'),
  ('dispo-validator',  'Deal Validator',               'Wholesaler completes deal validation; result pushed back to GHL with pass/fail/under review', '#d97706', 620, 180, 4, 'process'),
  ('dispo-buyer',      'Buyer Discovery',              'Identify and engage buyers in buyer network',          '#b45309', 620, 340, 5, 'process'),
  ('dispo-jv-agree',   'JV Agreement (Auto-Drafted)',  'Passed deals → Zapier/SignNow auto-drafts and sends JV agreement for signature', '#b45309', 890, 80,  6, 'process'),
  ('dispo-close',      'Close / Assignment',           'Assignment fee collected; deal closed',                '#92400e', 1140, 180, 7, 'outcome')
) AS v(slug, name, description, color, position_x, position_y, bucket_order, node_type);

-- ── Portfolio subprocess ───────────────────────────────────────────────────
WITH pt AS (SELECT id FROM process_buckets WHERE slug = 'portfolio')
INSERT INTO process_buckets (slug, name, description, color, position_x, position_y, bucket_order, parent_id, node_type)
SELECT slug, name, description, color, position_x, position_y, bucket_order, (SELECT id FROM pt), node_type FROM (VALUES
  ('port-intake',     'Deal Intake',                   'Deal comes in via email or bird dog form submission',  '#3b82f6', 80,  150, 1, 'source'),
  ('port-req-info',   'Request Information',           'Request property details from agent or seller',        '#2563eb', 330, 150, 2, 'process'),
  ('port-t1u',        'T1U + 2-Min Analysis',          'Quick underwriting check and deal viability analysis', '#1d4ed8', 580, 150, 3, 'process'),
  ('port-offer',      '10-Min Offer / LOI',            'Preliminary offer or Letter of Intent sent',           '#1e40af', 830, 150, 4, 'process'),
  ('port-fu1',        'Follow-Up Day 1',               'Quick check-in to confirm receipt and open conversation', '#1e3a8a', 1080, 80,  5, 'process'),
  ('port-fu3',        'Follow-Up Day 3',               'Gently apply urgency if no response',                  '#1e3a8a', 1080, 220, 6, 'process'),
  ('port-fu7',        'Follow-Up Day 7 (Last Touch)',  'Close the loop, keep relationship warm',               '#1e3a8a', 1080, 360, 7, 'process'),
  ('port-close',      'Under Contract / Hold',         'Deal accepted; move to value-add or hold strategy',    '#172554', 1330, 220, 8, 'outcome')
) AS v(slug, name, description, color, position_x, position_y, bucket_order, node_type);

-- ── Operations / Orbit subprocess ─────────────────────────────────────────
WITH ops AS (SELECT id FROM process_buckets WHERE slug = 'operations')
INSERT INTO process_buckets (slug, name, description, color, position_x, position_y, bucket_order, parent_id, node_type)
SELECT slug, name, description, color, position_x, position_y, bucket_order, (SELECT id FROM ops), node_type FROM (VALUES
  ('ops-orbit-form',   'Orbit Applicant Form',         'Candidate fills out Orbit Program interest form in GHL', '#8b5cf6', 80,  150, 1, 'source'),
  ('ops-orbit-wf',     'GHL Orbit Program WF',         'Triggers on form submission; creates Opportunity for applicant', '#7c3aed', 330, 150, 2, 'process'),
  ('ops-orbit-opp',    'Opportunity Created',          'Applicant opportunity created; review and onboard',     '#6d28d9', 580, 150, 3, 'process'),
  ('ops-orbit-train',  'Training & Mentorship',        'Orbit participant enters training pipeline',            '#5b21b6', 830, 150, 4, 'process'),
  ('ops-orbit-call',   'First Seller Call',            'Jr. Acq / Orbit participant handles first seller call', '#4c1d95', 1080, 150, 5, 'process'),
  ('ops-orbit-submit', 'Deal Submitted',               'Orbit participant submits deal to Autumn for review',   '#3b0764', 1330, 150, 6, 'outcome')
) AS v(slug, name, description, color, position_x, position_y, bucket_order, node_type);

-- ── Design Practice subprocess ─────────────────────────────────────────────
WITH des AS (SELECT id FROM process_buckets WHERE slug = 'design')
INSERT INTO process_buckets (slug, name, description, color, position_x, position_y, bucket_order, parent_id, node_type)
SELECT slug, name, description, color, position_x, position_y, bucket_order, (SELECT id FROM des), node_type FROM (VALUES
  ('des-inquiry',     'Client Inquiry / Lead',         'Inbound client inquiry or Evergreen in-house project request', '#ec4899', 80,  150, 1, 'source'),
  ('des-scope',       'Project Scoping & Intake',      'Define project scope, budget, timeline, style direction', '#db2777', 330, 150, 2, 'process'),
  ('des-brief',       'Design Brief / Mood Board',     'Create design brief and mood board for approval',       '#be185d', 580, 150, 3, 'process'),
  ('des-execution',   'Project Execution',             'Procurement, installation, renovation oversight',       '#9d174d', 830, 150, 4, 'process'),
  ('des-handoff',     'Handoff / Delivery',            'Final walkthrough, punch list, client sign-off',        '#831843', 1080, 150, 5, 'outcome')
) AS v(slug, name, description, color, position_x, position_y, bucket_order, node_type);

-- ── Subprocess edges (sequential flows) ───────────────────────────────────
INSERT INTO process_edges (source_id, target_id)
SELECT s.id, t.id FROM process_buckets s, process_buckets t WHERE (s.slug, t.slug) IN (
  -- Lead Gen
  ('lg-mls-leads','lg-import-ghl'), ('lg-lists','lg-import-ghl'), ('lg-seo-partner','lg-seo-wf'),
  ('lg-import-ghl','lg-ghl-wf'), ('lg-ghl-wf','lg-jr-acq'), ('lg-seo-wf','lg-jr-acq'),
  ('lg-jr-acq','lg-appt-outcome'),
  -- Acquisitions
  ('acq-contact','acq-assign'), ('acq-assign','acq-seller-call'), ('acq-assign','acq-appt-book'),
  ('acq-seller-call','acq-offer-gen'), ('acq-appt-book','acq-offer-gen'),
  ('acq-offer-gen','acq-followup'), ('acq-offer-gen','acq-accepted'),
  ('acq-followup','acq-accepted'), ('acq-accepted','acq-agreement'),
  -- Dispo
  ('dispo-acq-deal','dispo-route'), ('dispo-jv-web','dispo-route'),
  ('dispo-route','dispo-validator'), ('dispo-validator','dispo-jv-agree'),
  ('dispo-validator','dispo-buyer'), ('dispo-jv-agree','dispo-close'), ('dispo-buyer','dispo-close'),
  -- Portfolio
  ('port-intake','port-req-info'), ('port-req-info','port-t1u'), ('port-t1u','port-offer'),
  ('port-offer','port-fu1'), ('port-fu1','port-fu3'), ('port-fu3','port-fu7'),
  ('port-fu7','port-close'), ('port-offer','port-close'),
  -- Orbit
  ('ops-orbit-form','ops-orbit-wf'), ('ops-orbit-wf','ops-orbit-opp'),
  ('ops-orbit-opp','ops-orbit-train'), ('ops-orbit-train','ops-orbit-call'),
  ('ops-orbit-call','ops-orbit-submit'),
  -- Design
  ('des-inquiry','des-scope'), ('des-scope','des-brief'), ('des-brief','des-execution'),
  ('des-execution','des-handoff')
);
;
