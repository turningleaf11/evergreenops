-- Dept templates: configurable presets that drive per-dept-type behavior.
-- System templates ship with the app; custom templates can be cloned per workspace.
-- The dept page STRUCTURE stays universal; the template only controls what
-- queue/focus/stuck/kpi rules apply inside the standard blocks.

CREATE TABLE IF NOT EXISTS public.dept_templates (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  is_system   BOOLEAN NOT NULL DEFAULT false,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  config      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dept_templates_workspace ON public.dept_templates(workspace_id);

ALTER TABLE public.dept_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dept_templates_select" ON public.dept_templates;
CREATE POLICY "dept_templates_select" ON public.dept_templates
  FOR SELECT TO authenticated
  USING (is_system = true OR workspace_id = public.get_user_workspace_id());

DROP POLICY IF EXISTS "dept_templates_admin_all" ON public.dept_templates;
CREATE POLICY "dept_templates_admin_all" ON public.dept_templates
  FOR ALL TO authenticated
  USING (workspace_id = public.get_user_workspace_id() AND public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (workspace_id = public.get_user_workspace_id() AND public.has_role(auth.uid(), 'admin'::app_role));

-- Seed the 7 system templates.
-- config schema:
--   queue_sources: which entities go in "My queue" (tasks, projects, deals, etc.)
--   focus_inputs:  what Albus considers when synthesizing "Today's focus"
--   stuck_rules:   what triggers the "Stuck / Needs decision" flag
--   kpi_defaults:  default KPI strip metrics shown under Goals
--   work_views:    available views in the Work tab
INSERT INTO public.dept_templates (id, name, description, is_system, config) VALUES
  ('generic', 'Generic', 'A general-purpose team. Works for any dept that mostly does tasks and projects.', true, $${
    "queue_sources": ["tasks", "projects"],
    "focus_inputs": ["goals", "tasks", "projects", "activity"],
    "stuck_rules": [{"type": "task_overdue", "days": 3}, {"type": "project_stale", "days": 14}],
    "kpi_defaults": ["task_completion_rate", "project_velocity"],
    "work_views": ["list", "kanban"]
  }$$::jsonb),
  ('sales', 'Sales / Acquisitions', 'Pipeline-driven. Deals + follow-ups + leads.', true, $${
    "queue_sources": ["deals", "tasks", "follow_ups"],
    "focus_inputs": ["pipeline", "deals", "goals", "activity"],
    "stuck_rules": [{"type": "deal_no_touch", "days": 7}, {"type": "lead_not_contacted", "days": 2}],
    "kpi_defaults": ["pipeline_value", "deals_won", "conversion_rate", "avg_cycle"],
    "work_views": ["pipeline", "list"]
  }$$::jsonb),
  ('operations', 'Operations', 'Process-driven. Tasks + recurring procedures + SOPs.', true, $${
    "queue_sources": ["tasks", "recurring_tasks"],
    "focus_inputs": ["goals", "tasks", "sops_stale", "process_drift"],
    "stuck_rules": [{"type": "process_overdue"}, {"type": "sop_stale", "days": 90}],
    "kpi_defaults": ["sop_currency", "process_compliance", "throughput"],
    "work_views": ["list", "kanban", "calendar"]
  }$$::jsonb),
  ('engineering', 'Engineering', 'Build-driven. Issues + projects + reviews.', true, $${
    "queue_sources": ["issues", "projects", "tasks"],
    "focus_inputs": ["goals", "issues", "projects", "reviews_pending"],
    "stuck_rules": [{"type": "issue_blocked"}, {"type": "review_pending", "days": 2}],
    "kpi_defaults": ["issues_closed", "velocity", "review_throughput"],
    "work_views": ["kanban", "list"]
  }$$::jsonb),
  ('creative', 'Creative / Design', 'Deliverable-driven. Active deliverables + feedback rounds.', true, $${
    "queue_sources": ["projects", "tasks", "feedback_rounds"],
    "focus_inputs": ["goals", "projects", "deliverables_due", "feedback"],
    "stuck_rules": [{"type": "feedback_pending", "days": 3}, {"type": "deliverable_overdue"}],
    "kpi_defaults": ["deliverables_shipped", "feedback_cycle_time"],
    "work_views": ["kanban", "list"]
  }$$::jsonb),
  ('customer_success', 'Customer Success', 'Account-driven. Accounts + tickets + check-ins.', true, $${
    "queue_sources": ["accounts", "tickets", "check_ins"],
    "focus_inputs": ["goals", "accounts_at_risk", "tickets", "renewals"],
    "stuck_rules": [{"type": "ticket_overdue"}, {"type": "account_no_touch", "days": 30}, {"type": "renewal_soon", "days": 45}],
    "kpi_defaults": ["nps", "churn_risk", "ticket_resolution_time"],
    "work_views": ["list", "kanban"]
  }$$::jsonb),
  ('portfolio', 'Portfolio / Asset Mgmt', 'Asset-driven. Assets + reports + decisions.', true, $${
    "queue_sources": ["assets", "reports_due", "decisions_pending"],
    "focus_inputs": ["goals", "asset_performance", "reports_due", "maintenance"],
    "stuck_rules": [{"type": "report_overdue"}, {"type": "maintenance_overdue"}, {"type": "decision_pending", "days": 7}],
    "kpi_defaults": ["asset_count", "occupancy_rate", "noi", "maintenance_backlog"],
    "work_views": ["list", "calendar"]
  }$$::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Add template_id to departments. Default to 'generic' so existing depts keep working.
ALTER TABLE public.departments
  ADD COLUMN IF NOT EXISTS template_id TEXT REFERENCES public.dept_templates(id) ON DELETE SET NULL;

UPDATE public.departments SET template_id = 'generic' WHERE template_id IS NULL;

-- updated_at trigger
DROP TRIGGER IF EXISTS dept_templates_set_updated ON public.dept_templates;
CREATE TRIGGER dept_templates_set_updated
  BEFORE UPDATE ON public.dept_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();;
