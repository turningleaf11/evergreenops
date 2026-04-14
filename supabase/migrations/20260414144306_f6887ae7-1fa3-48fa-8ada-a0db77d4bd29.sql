
CREATE TABLE public.ceo_briefing_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  config jsonb NOT NULL DEFAULT '{"ghl_enabled": false, "database_ids": [], "ghl_kpis": ["pipeline_value", "opportunities_count", "opportunities_won", "opportunities_lost"]}'::jsonb,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.ceo_briefing_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage their briefing config"
ON public.ceo_briefing_config
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) AND auth.uid() = user_id)
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND auth.uid() = user_id);

CREATE TRIGGER update_ceo_briefing_config_updated_at
BEFORE UPDATE ON public.ceo_briefing_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
