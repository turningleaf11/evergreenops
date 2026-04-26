-- Email templates: workspace-scoped reusable subject + body snippets with merge fields
CREATE TABLE public.email_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL,
  name text NOT NULL,
  subject text NOT NULL DEFAULT '',
  body_html text NOT NULL DEFAULT '',
  category text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_templates_workspace ON public.email_templates(workspace_id);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view email templates"
ON public.email_templates FOR SELECT TO authenticated
USING (workspace_id = public.get_user_workspace_id());

CREATE POLICY "Workspace members can create email templates"
ON public.email_templates FOR INSERT TO authenticated
WITH CHECK (workspace_id = public.get_user_workspace_id());

CREATE POLICY "Creators or admins can update email templates"
ON public.email_templates FOR UPDATE TO authenticated
USING (
  workspace_id = public.get_user_workspace_id()
  AND (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
);

CREATE POLICY "Creators or admins can delete email templates"
ON public.email_templates FOR DELETE TO authenticated
USING (
  workspace_id = public.get_user_workspace_id()
  AND (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
);

CREATE TRIGGER trg_email_templates_updated_at
BEFORE UPDATE ON public.email_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Scheduled emails: queued sends executed by a cron-driven dispatcher
CREATE TABLE public.scheduled_emails (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL,
  user_id uuid NOT NULL,
  to_email text NOT NULL,
  cc text,
  bcc text,
  subject text NOT NULL,
  body_html text NOT NULL,
  thread_id text,
  in_reply_to text,
  send_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- pending | sent | failed | canceled
  error text,
  sent_message_id text,
  sent_thread_id text,
  attempts int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_scheduled_emails_due ON public.scheduled_emails(status, send_at);
CREATE INDEX idx_scheduled_emails_user ON public.scheduled_emails(user_id, status);
CREATE INDEX idx_scheduled_emails_workspace ON public.scheduled_emails(workspace_id);

ALTER TABLE public.scheduled_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see their own scheduled emails"
ON public.scheduled_emails FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users create their own scheduled emails"
ON public.scheduled_emails FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND workspace_id = public.get_user_workspace_id());

CREATE POLICY "Users cancel their own pending scheduled emails"
ON public.scheduled_emails FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users delete their own scheduled emails"
ON public.scheduled_emails FOR DELETE TO authenticated
USING (user_id = auth.uid());

CREATE TRIGGER trg_scheduled_emails_updated_at
BEFORE UPDATE ON public.scheduled_emails
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();