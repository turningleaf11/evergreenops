
CREATE TABLE public.directive_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  strategy_item_id UUID NOT NULL REFERENCES public.strategy_items(id) ON DELETE CASCADE,
  department_id TEXT,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  author_role TEXT NOT NULL DEFAULT 'leader',
  body TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX directive_messages_item_idx ON public.directive_messages(strategy_item_id);
CREATE INDEX directive_messages_created_idx ON public.directive_messages(created_at);

ALTER TABLE public.directive_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view directive messages" ON public.directive_messages
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can post directive messages" ON public.directive_messages
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Admins can manage directive messages" ON public.directive_messages
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
;
