
CREATE TABLE public.ceo_scratch_pad_archive (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  triaged_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.ceo_scratch_pad_archive ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own scratch archive"
ON public.ceo_scratch_pad_archive
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins manage all scratch archive"
ON public.ceo_scratch_pad_archive
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_scratch_archive_user_created ON public.ceo_scratch_pad_archive(user_id, created_at DESC);

CREATE TABLE public.ceo_triage_pending (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  text TEXT NOT NULL,
  category TEXT NOT NULL,
  suggested_assignee_id UUID,
  suggested_priority TEXT,
  reasoning TEXT,
  source_archive_id UUID REFERENCES public.ceo_scratch_pad_archive(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.ceo_triage_pending ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own triage pending"
ON public.ceo_triage_pending
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins manage all triage pending"
ON public.ceo_triage_pending
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_triage_pending_user_created ON public.ceo_triage_pending(user_id, created_at DESC);
