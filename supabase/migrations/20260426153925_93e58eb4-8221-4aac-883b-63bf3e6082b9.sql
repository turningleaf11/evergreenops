ALTER TABLE public.scheduled_emails
  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.gmail_workspace_account(id) ON DELETE SET NULL;