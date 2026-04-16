CREATE TABLE public.kanban_stage_colors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid,
  board_type text NOT NULL,
  stage_key text NOT NULL,
  color text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, board_type, stage_key)
);

ALTER TABLE public.kanban_stage_colors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view stage colors"
ON public.kanban_stage_colors FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert stage colors"
ON public.kanban_stage_colors FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update stage colors"
ON public.kanban_stage_colors FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated can delete stage colors"
ON public.kanban_stage_colors FOR DELETE TO authenticated USING (true);

CREATE POLICY "Admins manage stage colors"
ON public.kanban_stage_colors FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_kanban_stage_colors_updated_at
BEFORE UPDATE ON public.kanban_stage_colors
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();