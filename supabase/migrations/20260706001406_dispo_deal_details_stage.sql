ALTER TABLE public.dispo_deal_details ADD COLUMN dispo_stage text NOT NULL DEFAULT 'prep'
  CHECK (dispo_stage IN ('prep','marketing_active','marketing_paused','buyer_found','send_assignment',
    'pending_signature','pending_emd','title_issues','clear_for_closing','closed_won','lost_dead','lost_expired'));;
