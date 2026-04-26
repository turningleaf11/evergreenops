
-- ============== Multi-Gmail ==============
ALTER TABLE public.gmail_workspace_account
  ADD COLUMN IF NOT EXISTS label text,
  ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;

-- Only one default account per workspace (excluding revoked)
CREATE UNIQUE INDEX IF NOT EXISTS gmail_account_one_default_per_workspace
  ON public.gmail_workspace_account (workspace_id)
  WHERE is_default = true AND revoked_at IS NULL;

-- Speeds up "all active accounts in workspace" lookups
CREATE INDEX IF NOT EXISTS gmail_account_workspace_active_idx
  ON public.gmail_workspace_account (workspace_id)
  WHERE revoked_at IS NULL;

-- Backfill: mark the oldest active account in each workspace as default
WITH first_per_ws AS (
  SELECT DISTINCT ON (workspace_id) id
    FROM public.gmail_workspace_account
   WHERE revoked_at IS NULL
   ORDER BY workspace_id, connected_at ASC
)
UPDATE public.gmail_workspace_account
   SET is_default = true
 WHERE id IN (SELECT id FROM first_per_ws);

-- ============== Help articles ==============
CREATE TABLE IF NOT EXISTS public.help_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  body_md text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'General',
  sort_order int NOT NULL DEFAULT 0,
  published boolean NOT NULL DEFAULT true,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS help_articles_category_idx
  ON public.help_articles (category, sort_order);

ALTER TABLE public.help_articles ENABLE ROW LEVEL SECURITY;

-- Helper: which workspace is the developer/support workspace?
-- Hardcoded to Evergreen HQ. Changing this requires a new migration.
CREATE OR REPLACE FUNCTION public.is_developer_workspace_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.profiles p
      JOIN public.user_roles ur ON ur.user_id = p.user_id
     WHERE p.user_id = _user_id
       AND p.workspace_id = '2a918558-69fa-4d12-9b2d-fe59e0823997'::uuid
       AND ur.role = 'admin'
  )
$$;

DROP POLICY IF EXISTS "Anyone signed in can read published help" ON public.help_articles;
CREATE POLICY "Anyone signed in can read published help"
  ON public.help_articles FOR SELECT
  TO authenticated
  USING (published = true OR public.is_developer_workspace_admin(auth.uid()));

DROP POLICY IF EXISTS "Developer workspace admins can insert help" ON public.help_articles;
CREATE POLICY "Developer workspace admins can insert help"
  ON public.help_articles FOR INSERT
  TO authenticated
  WITH CHECK (public.is_developer_workspace_admin(auth.uid()));

DROP POLICY IF EXISTS "Developer workspace admins can update help" ON public.help_articles;
CREATE POLICY "Developer workspace admins can update help"
  ON public.help_articles FOR UPDATE
  TO authenticated
  USING (public.is_developer_workspace_admin(auth.uid()))
  WITH CHECK (public.is_developer_workspace_admin(auth.uid()));

DROP POLICY IF EXISTS "Developer workspace admins can delete help" ON public.help_articles;
CREATE POLICY "Developer workspace admins can delete help"
  ON public.help_articles FOR DELETE
  TO authenticated
  USING (public.is_developer_workspace_admin(auth.uid()));

CREATE TRIGGER help_articles_set_updated_at
  BEFORE UPDATE ON public.help_articles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed starter articles
INSERT INTO public.help_articles (slug, title, category, sort_order, body_md) VALUES
  ('getting-started', 'Welcome & Getting Started', 'Getting Started', 1,
$md$# Welcome to Evergreen Ops

This is your team's command center. Here's the 60-second tour:

- **Home** is your daily landing — priorities, reminders, and the company feed.
- **CEO Cockpit** (admins only) is where strategy, briefings, and translation live.
- **Departments** are command centers for each team.
- **Execution** holds Goals → Projects → Tasks → Issues.
- **Lists** (formerly Databases) is where custom team data lives.

Need help? Use the **Help** button at the bottom of the sidebar.
$md$),
  ('connecting-gmail', 'Connecting Gmail', 'Gmail', 1,
$md$# Connecting Gmail

You can connect one or more Gmail accounts to your workspace.

## To connect
1. Go to **Settings → Integrations → Gmail**.
2. Click **Connect Gmail**.
3. Approve the Google permission screen.

## Multiple accounts
After connecting one, click **Connect another Gmail** to add a second mailbox (e.g., Sales + Support). The first one is your default; you can change it any time.

## Troubleshooting
If you see "Gmail reconnect required", your refresh token was revoked by Google. Just click **Reconnect** in the toast and approve again.
$md$),
  ('inviting-team-members', 'Inviting team members', 'Getting Started', 2,
$md$# Inviting team members

Admins can invite team members from **People → Invite**.

- New members get an email with a sign-in link.
- Choose their **role** (Admin or User) and **department** at invite time — both can be changed later.
- Admins see all departments. Users only see their own.
$md$),
  ('crm-basics', 'CRM basics', 'CRM', 1,
$md$# CRM basics

The CRM is built for real estate acquisitions but works for any pipeline.

- **Contacts** — every person you talk to.
- **Companies** — organizations.
- **Deals** — opportunities, organized by **pipelines** with **stages** you customize.
- **Activities** — calls, emails, meetings, notes — all timestamped on the contact/company/deal.

Emails connect automatically: when you send from the inbox, they're logged on the linked deal/contact.
$md$),
  ('scorecards', 'Scorecards', 'Scorecards', 1,
$md$# Scorecards

Scorecards track the weekly numbers that matter. Each row is a metric with a goal and weekly actuals.

- Green = met goal. Red = missed.
- Connect to GoHighLevel to auto-pull pipeline numbers (admin: Settings → Integrations).
$md$);
