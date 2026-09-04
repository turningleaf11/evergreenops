CREATE TABLE IF NOT EXISTS public.kanban_stage_colors (
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

CREATE POLICY "Primary admin manages stage colors"
ON public.kanban_stage_colors FOR ALL TO authenticated
USING (is_primary_admin(auth.uid()))
WITH CHECK (is_primary_admin(auth.uid()));

CREATE TRIGGER update_kanban_stage_colors_updated_at
BEFORE UPDATE ON public.kanban_stage_colors
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();;
