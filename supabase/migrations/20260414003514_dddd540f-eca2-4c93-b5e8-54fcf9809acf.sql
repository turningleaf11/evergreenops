
-- 1. Enhance goals table for SMART goals
ALTER TABLE public.goals
  ADD COLUMN IF NOT EXISTS measurable_target text DEFAULT '',
  ADD COLUMN IF NOT EXISTS deadline date,
  ADD COLUMN IF NOT EXISTS key_results jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS alignment_notes text DEFAULT '';

-- 2. Add project_id to documents
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;

-- 3. Create notes table
CREATE TABLE public.notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'Untitled Note',
  content text DEFAULT '',
  converted_doc_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notes" ON public.notes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own notes" ON public.notes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own notes" ON public.notes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own notes" ON public.notes FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all notes" ON public.notes FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_notes_updated_at BEFORE UPDATE ON public.notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Create reminders table
CREATE TABLE public.reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  assigned_to uuid,
  title text NOT NULL,
  description text DEFAULT '',
  due_at timestamptz,
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own or assigned reminders" ON public.reminders FOR SELECT USING (auth.uid() = user_id OR auth.uid() = assigned_to);
CREATE POLICY "Users can create reminders" ON public.reminders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Creators can update their reminders" ON public.reminders FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Creators can delete their reminders" ON public.reminders FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all reminders" ON public.reminders FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_reminders_updated_at BEFORE UPDATE ON public.reminders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Create entity_links table
CREATE TABLE public.entity_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type text NOT NULL,
  source_id uuid NOT NULL,
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.entity_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view links" ON public.entity_links FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can create links" ON public.entity_links FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Creators can delete their links" ON public.entity_links FOR DELETE TO authenticated USING (auth.uid() = created_by);
CREATE POLICY "Admins can manage all links" ON public.entity_links FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
