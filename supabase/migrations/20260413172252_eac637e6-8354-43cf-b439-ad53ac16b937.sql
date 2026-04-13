
-- Add recurring columns to tasks
ALTER TABLE public.tasks
  ADD COLUMN is_recurring boolean NOT NULL DEFAULT false,
  ADD COLUMN recurrence_rule jsonb DEFAULT NULL,
  ADD COLUMN recurring_parent_id uuid DEFAULT NULL;

-- Create task_templates table
CREATE TABLE public.task_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  subtasks jsonb NOT NULL DEFAULT '[]',
  tags text[] NOT NULL DEFAULT '{}',
  priority text NOT NULL DEFAULT 'medium',
  assignee_id uuid DEFAULT NULL,
  due_date_offset_days integer DEFAULT NULL,
  recurrence_rule jsonb DEFAULT NULL,
  custom_fields jsonb NOT NULL DEFAULT '{}',
  created_by uuid DEFAULT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.task_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view templates"
  ON public.task_templates FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create templates"
  ON public.task_templates FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creators can update their templates"
  ON public.task_templates FOR UPDATE TO authenticated
  USING (auth.uid() = created_by);

CREATE POLICY "Creators can delete their templates"
  ON public.task_templates FOR DELETE TO authenticated
  USING (auth.uid() = created_by);

CREATE POLICY "Admins can manage all templates"
  ON public.task_templates FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_task_templates_updated_at
  BEFORE UPDATE ON public.task_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
