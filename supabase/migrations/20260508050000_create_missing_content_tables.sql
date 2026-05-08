-- Defensive migration for partially scaffolded app surfaces:
-- Wiki/Docs, Lists, List Forms, Feed, comments, and reactions.

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Wiki / Docs -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL DEFAULT 'Untitled',
  content TEXT NOT NULL DEFAULT '',
  parent_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  project_id UUID,
  visibility TEXT NOT NULL DEFAULT 'workspace',
  shared_with JSONB NOT NULL DEFAULT '{"departmentIds": [], "memberIds": []}'::jsonb,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active',
  cover_url TEXT,
  icon TEXT,
  cover_position INTEGER NOT NULL DEFAULT 50,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT 'Untitled';
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS content TEXT NOT NULL DEFAULT '';
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.documents(id) ON DELETE SET NULL;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS project_id UUID;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'workspace';
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS shared_with JSONB NOT NULL DEFAULT '{"departmentIds": [], "memberIds": []}'::jsonb;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS author_name TEXT;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS cover_url TEXT;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS icon TEXT;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS cover_position INTEGER NOT NULL DEFAULT 50;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_documents_updated_at ON public.documents(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_parent_id ON public.documents(parent_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON public.documents(status);

-- Lists / Databases ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.databases_meta (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT 'Database',
  visibility TEXT NOT NULL DEFAULT 'workspace',
  shared_with JSONB NOT NULL DEFAULT '{"departmentIds": [], "memberIds": []}'::jsonb,
  columns JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_name TEXT,
  workspace_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.databases_meta ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT 'Untitled List';
ALTER TABLE public.databases_meta ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
ALTER TABLE public.databases_meta ADD COLUMN IF NOT EXISTS icon TEXT NOT NULL DEFAULT 'Database';
ALTER TABLE public.databases_meta ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'workspace';
ALTER TABLE public.databases_meta ADD COLUMN IF NOT EXISTS shared_with JSONB NOT NULL DEFAULT '{"departmentIds": [], "memberIds": []}'::jsonb;
ALTER TABLE public.databases_meta ADD COLUMN IF NOT EXISTS columns JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.databases_meta ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.databases_meta ADD COLUMN IF NOT EXISTS created_by_name TEXT;
ALTER TABLE public.databases_meta ADD COLUMN IF NOT EXISTS workspace_id UUID;
ALTER TABLE public.databases_meta ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.databases_meta ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.database_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  database_id UUID NOT NULL REFERENCES public.databases_meta(id) ON DELETE CASCADE,
  values JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.database_rows ADD COLUMN IF NOT EXISTS database_id UUID REFERENCES public.databases_meta(id) ON DELETE CASCADE;
ALTER TABLE public.database_rows ADD COLUMN IF NOT EXISTS values JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.database_rows ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.database_rows ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.database_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  database_id UUID NOT NULL REFERENCES public.databases_meta(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  view_type TEXT NOT NULL DEFAULT 'table',
  filters JSONB NOT NULL DEFAULT '[]'::jsonb,
  sorts JSONB NOT NULL DEFAULT '[]'::jsonb,
  group_by TEXT,
  column_order TEXT[] NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.database_views ADD COLUMN IF NOT EXISTS database_id UUID REFERENCES public.databases_meta(id) ON DELETE CASCADE;
ALTER TABLE public.database_views ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT 'Untitled View';
ALTER TABLE public.database_views ADD COLUMN IF NOT EXISTS view_type TEXT NOT NULL DEFAULT 'table';
ALTER TABLE public.database_views ADD COLUMN IF NOT EXISTS filters JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.database_views ADD COLUMN IF NOT EXISTS sorts JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.database_views ADD COLUMN IF NOT EXISTS group_by TEXT;
ALTER TABLE public.database_views ADD COLUMN IF NOT EXISTS column_order TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE public.database_views ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.database_views ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.database_views ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_database_rows_database_id ON public.database_rows(database_id);
CREATE INDEX IF NOT EXISTS idx_database_views_database_id ON public.database_views(database_id);

-- List forms / API / webhooks --------------------------------------------------
CREATE TABLE IF NOT EXISTS public.database_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  database_id UUID NOT NULL REFERENCES public.databases_meta(id) ON DELETE CASCADE,
  workspace_id UUID,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  visibility TEXT NOT NULL DEFAULT 'internal',
  fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  submit_message TEXT NOT NULL DEFAULT 'Thanks! Your submission was received.',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.database_forms ADD COLUMN IF NOT EXISTS database_id UUID REFERENCES public.databases_meta(id) ON DELETE CASCADE;
ALTER TABLE public.database_forms ADD COLUMN IF NOT EXISTS workspace_id UUID;
ALTER TABLE public.database_forms ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE public.database_forms ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT 'Untitled form';
ALTER TABLE public.database_forms ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
ALTER TABLE public.database_forms ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'internal';
ALTER TABLE public.database_forms ADD COLUMN IF NOT EXISTS fields JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.database_forms ADD COLUMN IF NOT EXISTS submit_message TEXT NOT NULL DEFAULT 'Thanks! Your submission was received.';
ALTER TABLE public.database_forms ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.database_forms ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.database_forms ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.database_forms ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS idx_database_forms_slug ON public.database_forms(slug);
CREATE INDEX IF NOT EXISTS idx_database_forms_database_id ON public.database_forms(database_id);

CREATE TABLE IF NOT EXISTS public.database_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  database_id UUID NOT NULL REFERENCES public.databases_meta(id) ON DELETE CASCADE,
  workspace_id UUID,
  label TEXT NOT NULL DEFAULT 'API key',
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.database_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  database_id UUID NOT NULL REFERENCES public.databases_meta(id) ON DELETE CASCADE,
  workspace_id UUID,
  direction TEXT NOT NULL DEFAULT 'out',
  label TEXT NOT NULL DEFAULT 'Webhook',
  url TEXT,
  events TEXT[] NOT NULL DEFAULT '{row.created,row.updated,row.deleted}',
  secret TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  last_status INTEGER,
  last_delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.database_webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES public.database_webhooks(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  status_code INTEGER,
  response_body TEXT,
  error TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_database_api_keys_database_id ON public.database_api_keys(database_id);
CREATE INDEX IF NOT EXISTS idx_database_webhooks_database_id ON public.database_webhooks(database_id);
CREATE INDEX IF NOT EXISTS idx_database_webhook_deliveries_webhook_id ON public.database_webhook_deliveries(webhook_id, created_at DESC);

-- Internal forms ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.form_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.form_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES public.form_templates(id) ON DELETE SET NULL,
  submitted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  values JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  review_notes TEXT NOT NULL DEFAULT '',
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_form_submissions_template_id ON public.form_submissions(template_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_submitted_by ON public.form_submissions(submitted_by);

-- Feed -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name TEXT,
  content TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  gif_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS author_name TEXT;
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS pinned BOOLEAN DEFAULT false;
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'general';
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS banner_color TEXT;
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.poll_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  option_index INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT poll_votes_poll_user_key UNIQUE (poll_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.kudos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  to_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  message TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'great_work',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.post_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT post_reactions_entity_user_emoji_key UNIQUE (entity_type, entity_id, user_id, emoji)
);

CREATE TABLE IF NOT EXISTS public.post_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name TEXT,
  content TEXT NOT NULL DEFAULT '',
  gif_url TEXT,
  audio_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_posts_created_at ON public.posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_polls_created_at ON public.polls(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_poll_votes_poll_id ON public.poll_votes(poll_id);
CREATE INDEX IF NOT EXISTS idx_kudos_created_at ON public.kudos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_reactions_entity ON public.post_reactions(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_post_replies_entity ON public.post_replies(entity_type, entity_id, created_at);

-- RLS --------------------------------------------------------------------------
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.databases_meta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.database_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.database_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.database_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.database_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.database_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.database_webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kudos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_replies ENABLE ROW LEVEL SECURITY;

-- Simple permissive authenticated policies for app-owned collaboration data.
-- Edge functions that need public access use the service role key.
DROP POLICY IF EXISTS "documents authenticated all" ON public.documents;
CREATE POLICY "documents authenticated all" ON public.documents FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "databases_meta authenticated all" ON public.databases_meta;
CREATE POLICY "databases_meta authenticated all" ON public.databases_meta FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "database_rows authenticated all" ON public.database_rows;
CREATE POLICY "database_rows authenticated all" ON public.database_rows FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "database_views authenticated all" ON public.database_views;
CREATE POLICY "database_views authenticated all" ON public.database_views FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "database_forms authenticated all" ON public.database_forms;
CREATE POLICY "database_forms authenticated all" ON public.database_forms FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "database_api_keys authenticated all" ON public.database_api_keys;
CREATE POLICY "database_api_keys authenticated all" ON public.database_api_keys FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "database_webhooks authenticated all" ON public.database_webhooks;
CREATE POLICY "database_webhooks authenticated all" ON public.database_webhooks FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "database_webhook_deliveries authenticated all" ON public.database_webhook_deliveries;
CREATE POLICY "database_webhook_deliveries authenticated all" ON public.database_webhook_deliveries FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "form_templates authenticated all" ON public.form_templates;
CREATE POLICY "form_templates authenticated all" ON public.form_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "form_submissions authenticated all" ON public.form_submissions;
CREATE POLICY "form_submissions authenticated all" ON public.form_submissions FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "posts authenticated all" ON public.posts;
CREATE POLICY "posts authenticated all" ON public.posts FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "polls authenticated all" ON public.polls;
CREATE POLICY "polls authenticated all" ON public.polls FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "poll_votes authenticated all" ON public.poll_votes;
CREATE POLICY "poll_votes authenticated all" ON public.poll_votes FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "kudos authenticated all" ON public.kudos;
CREATE POLICY "kudos authenticated all" ON public.kudos FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "post_reactions authenticated all" ON public.post_reactions;
CREATE POLICY "post_reactions authenticated all" ON public.post_reactions FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "post_replies authenticated all" ON public.post_replies;
CREATE POLICY "post_replies authenticated all" ON public.post_replies FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Updated-at triggers ----------------------------------------------------------
DO $$
DECLARE
  table_name text;
  trigger_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'documents', 'databases_meta', 'database_rows', 'database_views', 'database_forms',
    'database_webhooks', 'form_templates', 'form_submissions', 'posts', 'polls',
    'poll_votes', 'kudos', 'post_replies'
  ]
  LOOP
    trigger_name := 'set_' || table_name || '_updated_at';
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = trigger_name) THEN
      EXECUTE format(
        'CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()',
        trigger_name,
        table_name
      );
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
