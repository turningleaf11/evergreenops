
-- 1. Add stripe_price_id to addon_packs
ALTER TABLE public.addon_packs ADD COLUMN IF NOT EXISTS stripe_price_id text;

-- 2. Note folders
CREATE TABLE public.note_folders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  user_id uuid NOT NULL,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.note_folders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own folders" ON public.note_folders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own folders" ON public.note_folders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own folders" ON public.note_folders FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own folders" ON public.note_folders FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER update_note_folders_updated_at BEFORE UPDATE ON public.note_folders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Time entries
CREATE TABLE public.time_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  clock_in timestamptz NOT NULL DEFAULT now(),
  clock_out timestamptz,
  is_manual boolean NOT NULL DEFAULT false,
  notes text DEFAULT '',
  break_minutes integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own time entries" ON public.time_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own time entries" ON public.time_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own time entries" ON public.time_entries FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own time entries" ON public.time_entries FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all time entries" ON public.time_entries FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER update_time_entries_updated_at BEFORE UPDATE ON public.time_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Time off requests
CREATE TABLE public.time_off_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  type text NOT NULL DEFAULT 'pto',
  status text NOT NULL DEFAULT 'pending',
  approved_by uuid,
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.time_off_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own requests" ON public.time_off_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own requests" ON public.time_off_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own pending requests" ON public.time_off_requests FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own pending requests" ON public.time_off_requests FOR DELETE USING (auth.uid() = user_id AND status = 'pending');
CREATE POLICY "Admins can manage all time off requests" ON public.time_off_requests FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER update_time_off_requests_updated_at BEFORE UPDATE ON public.time_off_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Market research
CREATE TABLE public.market_research (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  market_name text NOT NULL,
  strategy text NOT NULL DEFAULT '',
  ai_analysis jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.market_research ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view market research" ON public.market_research FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can create market research" ON public.market_research FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Admins can manage all market research" ON public.market_research FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER update_market_research_updated_at BEFORE UPDATE ON public.market_research FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Polls
CREATE TABLE public.polls (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text DEFAULT '',
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view polls" ON public.polls FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage polls" ON public.polls FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Creators can manage own polls" ON public.polls FOR ALL TO authenticated USING (auth.uid() = created_by);
CREATE TRIGGER update_polls_updated_at BEFORE UPDATE ON public.polls FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Poll votes
CREATE TABLE public.poll_votes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  poll_id uuid NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  option_index integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(poll_id, user_id)
);
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view votes" ON public.poll_votes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can cast own vote" ON public.poll_votes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can change own vote" ON public.poll_votes FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own vote" ON public.poll_votes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 8. Kudos
CREATE TABLE public.kudos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  from_user_id uuid NOT NULL,
  to_user_id uuid NOT NULL,
  message text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'great_work',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.kudos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view kudos" ON public.kudos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can give kudos" ON public.kudos FOR INSERT TO authenticated WITH CHECK (auth.uid() = from_user_id);
CREATE POLICY "Users can delete own kudos" ON public.kudos FOR DELETE TO authenticated USING (auth.uid() = from_user_id);

-- 9. Form templates
CREATE TABLE public.form_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text DEFAULT '',
  fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.form_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view active templates" ON public.form_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage templates" ON public.form_templates FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER update_form_templates_updated_at BEFORE UPDATE ON public.form_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 10. Form submissions
CREATE TABLE public.form_submissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id uuid NOT NULL REFERENCES public.form_templates(id) ON DELETE CASCADE,
  submitted_by uuid NOT NULL,
  values jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  review_notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own submissions" ON public.form_submissions FOR SELECT TO authenticated USING (auth.uid() = submitted_by);
CREATE POLICY "Users can create submissions" ON public.form_submissions FOR INSERT TO authenticated WITH CHECK (auth.uid() = submitted_by);
CREATE POLICY "Admins can manage all submissions" ON public.form_submissions FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER update_form_submissions_updated_at BEFORE UPDATE ON public.form_submissions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 11. Profile enhancements
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS skills text[] DEFAULT '{}';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS timezone text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS availability_status text DEFAULT 'available';
