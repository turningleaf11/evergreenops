-- Minimal upfront intake for a new business plan: what kind of venture this
-- is (tunes what Albus later suggests — a Fix & Flip needs different
-- deliverable categories than a SaaS business) and why it exists. Free text,
-- not an enum — the taxonomy of venture types isn't ours to fix in advance.

alter table public.business_plans
  add column if not exists type text,
  add column if not exists purpose text;
;
