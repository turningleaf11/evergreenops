-- 1. Add status to documents
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
CREATE INDEX IF NOT EXISTS idx_documents_status ON public.documents(status);

-- Update SELECT policy: regular users only see active docs, admins see all
DROP POLICY IF EXISTS "Authenticated users can view documents" ON public.documents;
CREATE POLICY "Users view active docs, admins view all"
ON public.documents
FOR SELECT
TO authenticated
USING (
  status = 'active'
  OR has_role(auth.uid(), 'admin'::app_role)
  OR auth.uid() = author_id
);

-- 2. Comments: attachments + mentions
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS mentions uuid[] NOT NULL DEFAULT '{}'::uuid[];

-- 3. Comment reactions table
CREATE TABLE IF NOT EXISTS public.comment_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL,
  user_id uuid NOT NULL,
  emoji text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (comment_id, user_id, emoji)
);

ALTER TABLE public.comment_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view comment reactions"
ON public.comment_reactions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can add own reactions"
ON public.comment_reactions FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove own reactions"
ON public.comment_reactions FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_comment_reactions_comment ON public.comment_reactions(comment_id);