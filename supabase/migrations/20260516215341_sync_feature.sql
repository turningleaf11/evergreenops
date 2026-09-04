-- Sync feature: channels, members, threads, messages, tags
CREATE TABLE IF NOT EXISTS public.sync_channels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('direct', 'group', 'adhoc')),
  name TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sync_channels_type_idx ON public.sync_channels(type);

CREATE TABLE IF NOT EXISTS public.sync_channel_members (
  channel_id UUID NOT NULL REFERENCES public.sync_channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (channel_id, user_id)
);
CREATE INDEX IF NOT EXISTS sync_channel_members_user_idx ON public.sync_channel_members(user_id);

CREATE TABLE IF NOT EXISTS public.sync_threads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id UUID NOT NULL REFERENCES public.sync_channels(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  tag TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sync_threads_channel_idx ON public.sync_threads(channel_id);
CREATE INDEX IF NOT EXISTS sync_threads_status_idx ON public.sync_threads(status);
CREATE INDEX IF NOT EXISTS sync_threads_last_activity_idx ON public.sync_threads(last_activity_at DESC);

CREATE TABLE IF NOT EXISTS public.sync_thread_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id UUID NOT NULL REFERENCES public.sync_threads(id) ON DELETE CASCADE,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  body TEXT NOT NULL DEFAULT '',
  mentions JSONB DEFAULT '[]'::jsonb,
  attachments JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sync_thread_messages_thread_idx ON public.sync_thread_messages(thread_id);
CREATE INDEX IF NOT EXISTS sync_thread_messages_created_idx ON public.sync_thread_messages(created_at);

CREATE TABLE IF NOT EXISTS public.sync_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  emoji TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'gray',
  tracks_open_state BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.sync_tags (key, label, emoji, color, tracks_open_state, sort_order, is_system) VALUES
  ('idea',      'Idea',           '💡', 'blue',   false, 10, true),
  ('stuck',     'Stuck',          '🚧', 'orange', true,  20, true),
  ('need_call', 'Need your call', '❓', 'purple', true,  30, true),
  ('off',       'Off',            '🚩', 'red',    true,  40, true),
  ('todo',      'To-do',          '✅', 'green',  true,  50, true),
  ('fyi',       'FYI',            '🎯', 'gray',   false, 60, true)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.sync_channels         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_channel_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_threads          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_thread_messages  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_tags             ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_sync_member(_channel_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.sync_channel_members WHERE channel_id = _channel_id AND user_id = _user_id);
$$;

DROP POLICY IF EXISTS "sync_channels_select_members" ON public.sync_channels;
CREATE POLICY "sync_channels_select_members" ON public.sync_channels FOR SELECT TO authenticated USING (public.is_sync_member(id, auth.uid()));
DROP POLICY IF EXISTS "sync_channels_insert_self" ON public.sync_channels;
CREATE POLICY "sync_channels_insert_self" ON public.sync_channels FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
DROP POLICY IF EXISTS "sync_channels_admin_all" ON public.sync_channels;
CREATE POLICY "sync_channels_admin_all" ON public.sync_channels FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "sync_members_select" ON public.sync_channel_members;
CREATE POLICY "sync_members_select" ON public.sync_channel_members FOR SELECT TO authenticated USING (public.is_sync_member(channel_id, auth.uid()));
DROP POLICY IF EXISTS "sync_members_insert" ON public.sync_channel_members;
CREATE POLICY "sync_members_insert" ON public.sync_channel_members FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (SELECT 1 FROM public.sync_channels c WHERE c.id = channel_id AND c.created_by = auth.uid())
  OR public.is_sync_member(channel_id, auth.uid())
);
DROP POLICY IF EXISTS "sync_members_admin_all" ON public.sync_channel_members;
CREATE POLICY "sync_members_admin_all" ON public.sync_channel_members FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "sync_threads_select" ON public.sync_threads;
CREATE POLICY "sync_threads_select" ON public.sync_threads FOR SELECT TO authenticated USING (public.is_sync_member(channel_id, auth.uid()));
DROP POLICY IF EXISTS "sync_threads_insert" ON public.sync_threads;
CREATE POLICY "sync_threads_insert" ON public.sync_threads FOR INSERT TO authenticated WITH CHECK (public.is_sync_member(channel_id, auth.uid()) AND auth.uid() = author_id);
DROP POLICY IF EXISTS "sync_threads_update_members" ON public.sync_threads;
CREATE POLICY "sync_threads_update_members" ON public.sync_threads FOR UPDATE TO authenticated USING (public.is_sync_member(channel_id, auth.uid()));
DROP POLICY IF EXISTS "sync_threads_delete" ON public.sync_threads;
CREATE POLICY "sync_threads_delete" ON public.sync_threads FOR DELETE TO authenticated USING (auth.uid() = author_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "sync_messages_select" ON public.sync_thread_messages;
CREATE POLICY "sync_messages_select" ON public.sync_thread_messages FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.sync_threads t WHERE t.id = thread_id AND public.is_sync_member(t.channel_id, auth.uid())));
DROP POLICY IF EXISTS "sync_messages_insert" ON public.sync_thread_messages;
CREATE POLICY "sync_messages_insert" ON public.sync_thread_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id AND EXISTS (SELECT 1 FROM public.sync_threads t WHERE t.id = thread_id AND public.is_sync_member(t.channel_id, auth.uid())));

DROP POLICY IF EXISTS "sync_tags_select" ON public.sync_tags;
CREATE POLICY "sync_tags_select" ON public.sync_tags FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "sync_tags_admin_all" ON public.sync_tags;
CREATE POLICY "sync_tags_admin_all" ON public.sync_tags FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS sync_channels_set_updated ON public.sync_channels;
CREATE TRIGGER sync_channels_set_updated BEFORE UPDATE ON public.sync_channels FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS sync_threads_set_updated ON public.sync_threads;
CREATE TRIGGER sync_threads_set_updated BEFORE UPDATE ON public.sync_threads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.sync_bump_thread_activity()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.sync_threads SET last_activity_at = NEW.created_at WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS sync_bump_thread_activity_trg ON public.sync_thread_messages;
CREATE TRIGGER sync_bump_thread_activity_trg AFTER INSERT ON public.sync_thread_messages FOR EACH ROW EXECUTE FUNCTION public.sync_bump_thread_activity();

DO $seed$
DECLARE
  ceo_id UUID;
  leader RECORD;
  new_channel_id UUID;
  all_lead_id UUID;
BEGIN
  SELECT user_id INTO ceo_id FROM public.user_roles WHERE role = 'admin' AND is_primary = true LIMIT 1;
  IF ceo_id IS NULL THEN RETURN; END IF;

  SELECT id INTO all_lead_id FROM public.sync_channels WHERE type = 'group' AND name = 'All Leadership' LIMIT 1;
  IF all_lead_id IS NULL THEN
    INSERT INTO public.sync_channels (type, name, created_by) VALUES ('group', 'All Leadership', ceo_id) RETURNING id INTO all_lead_id;
  END IF;

  INSERT INTO public.sync_channel_members (channel_id, user_id) VALUES (all_lead_id, ceo_id) ON CONFLICT DO NOTHING;

  FOR leader IN
    SELECT DISTINCT p.user_id FROM public.profiles p
    WHERE (COALESCE(p.is_leader, false) = true OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.user_id AND ur.role = 'admin'))
      AND p.user_id IS NOT NULL AND p.user_id <> ceo_id
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.sync_channels c
      JOIN public.sync_channel_members m1 ON m1.channel_id = c.id AND m1.user_id = ceo_id
      JOIN public.sync_channel_members m2 ON m2.channel_id = c.id AND m2.user_id = leader.user_id
      WHERE c.type = 'direct'
    ) THEN
      INSERT INTO public.sync_channels (type, created_by) VALUES ('direct', ceo_id) RETURNING id INTO new_channel_id;
      INSERT INTO public.sync_channel_members (channel_id, user_id) VALUES (new_channel_id, ceo_id), (new_channel_id, leader.user_id);
    END IF;

    INSERT INTO public.sync_channel_members (channel_id, user_id) VALUES (all_lead_id, leader.user_id) ON CONFLICT DO NOTHING;
  END LOOP;
END $seed$;;
