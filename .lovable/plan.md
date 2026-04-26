# Plan: Multi-Gmail, Developer Page, Help Center, OAuth Fix

Four bundled deliverables. Done in this order so the riskiest (multi-Gmail schema change) lands first.

---

## 1. Phase 1 OAuth fix (do first, unblocks you today)

No code change in this step — a Google Cloud Console change you'll make:

1. Open Google Cloud Console → **APIs & Services → OAuth consent screen** for the project that owns `GOOGLE_OAUTH_CLIENT_ID`.
2. If User type = **External** and Status = **Testing**: scroll to **Test users**, add your email (and any teammate emails you want to test with). Save.
3. Confirm **Gmail API** is enabled under APIs & Services → Library.
4. Confirm scopes include: `gmail.readonly`, `gmail.send`, `gmail.modify`, `userinfo.email`, `openid`.
5. Retry **Settings → Integrations → Gmail → Connect Gmail**.

I'll add a written checklist as `docs/gmail-oauth-setup.md` in the repo (covers Phase 1 above + Phase 2 verification submission for when you onboard real customers).

---

## 2. Multi-Gmail (Medium scope)

### Schema change
- Drop the implicit one-per-workspace assumption on `gmail_workspace_account`. Today it's already keyed by `id` (not `workspace_id`), so no migration to the table itself — but I'll:
  - Add a `label` text column (e.g. "Sales", "Support") so users can name each mailbox.
  - Add a `is_default` boolean (only one per workspace via partial unique index) for the default "send from".
  - Add an index on `(workspace_id, revoked_at)` for the inbox aggregation.
- `gmail_oauth_callback` already inserts a new row per OAuth completion; I'll change it to **always create a new row** instead of updating, and set `is_default=true` only if it's the workspace's first connected account.

### Edge functions (`_shared/gmail.ts`, `gmail-send`, `gmail-list-threads`, `gmail-get-thread`, `gmail-modify`, `gmail-disconnect`)
- Accept an optional `account_id` parameter. If omitted, fall back to the workspace's default account (preserves existing callers).
- `gmail-list-threads`: when called without `account_id`, fan out across all of the workspace's connected accounts and merge results, tagging each thread with its source account email.
- `gmail-disconnect`: now requires `account_id`.

### UI
- **Settings → Integrations → Gmail**: list view of all connected accounts (email, label, default badge, disconnect button) + a single "Connect another Gmail" button. Inline rename for labels. Radio to set default.
- **ComposeModal / ComposePanel**: add a "From" dropdown of all accessible accounts; default to the workspace default. Pass `account_id` through to `gmail-send`.
- **Inbox**: add a small "From: All accounts ▾" filter in the header. Each thread row gets a tiny mailbox indicator (initial of the account, or color dot) when more than one account is connected.

### Access rules
Stays workspace-wide for now (one rules row per workspace, applies to all accounts). Per-account permissions deferred.

---

## 3. Private Developer page (your workspace only)

### Gating
- Add `src/lib/developer.ts` exporting:
  ```ts
  export const DEVELOPER_WORKSPACE_ID = "2a918558-69fa-4d12-9b2d-fe59e0823997"; // Evergreen HQ
  export function useIsDeveloperWorkspace() { ... }
  ```
- New route `/settings/developer` wrapped in a `DeveloperRoute` guard that redirects anyone else to `/settings`. Sidebar link only renders when the check passes.

### Page contents (v1 — extend later)
- **System info**: workspace ID, your user ID, app version, current route, env (test/live).
- **Gmail debug panel**: list every `gmail_workspace_account` row in your workspace with raw status (revoked_at, last refresh outcome) + a "Force refresh token" button that calls a new admin-only edge function `gmail-debug-refresh`.
- **Edge function shortcuts**: buttons to invoke common functions (`daily-briefing`, `ceo-briefing-sync`, `scheduled-email-dispatch`) on demand, with raw JSON response viewer.
- **Feature flags playground**: read/write the addon-enabled flags for your workspace without going through the regular UI.

The whole page is gated by workspace ID — no other tenant sees the route, the link, or can hit the debug edge function (it checks workspace ID server-side too).

---

## 4. Help Center

### Schema
New table `help_articles`:
- `id uuid pk`, `slug text unique`, `title text`, `body_md text`, `category text` (e.g. "Gmail", "CRM", "Getting Started"), `sort_order int`, `published bool`, `updated_by uuid`, timestamps.
- RLS: SELECT to all authenticated users (help is global, not per-workspace). INSERT/UPDATE/DELETE only to users with `admin` role on the developer workspace (you), via a new RPC `can_edit_help_articles()`. This way help docs are global across all tenants and only you can edit them.
- Seed with 4–5 starter articles: "Connecting Gmail", "Inviting team members", "CRM basics", "Scorecards", "Getting started".

### UI
- New `/help` page:
  - Left rail: categories + article list (filterable by search).
  - Right pane: rendered markdown of the selected article.
  - If you (developer workspace admin) are viewing: an **Edit** button toggles to a markdown editor + Save. Inline "New article" button.
- Markdown rendering via `react-markdown` (already in repo if used elsewhere — otherwise add).

### Sidebar entry
- Add a `HelpCircle` icon + "Help" item in `AppSidebar` `SidebarFooter` (bottom-left, below the existing footer items, above sign-out). Visible to all users.
- Clicking opens `/help`.

### Support contact
- Inside the help page header: a "Contact support" button → opens `mailto:<your-email>?subject=Support — <workspace name>`.
- I'll need your support email — I'll prompt you for it during build, or you can put it in `src/lib/developer.ts` as `SUPPORT_EMAIL`.
- Leaves room for a future chat widget (we'll add a placeholder slot in the page layout).

---

## File / migration summary

**Migrations**
- `gmail_workspace_account`: add `label`, `is_default`, partial unique index, supporting index.
- New `help_articles` table + RLS + RPC `can_edit_help_articles()`.
- Seed help articles.

**New files**
- `docs/gmail-oauth-setup.md`
- `src/lib/developer.ts`
- `src/pages/DeveloperPage.tsx`
- `src/pages/HelpPage.tsx`
- `src/components/help/ArticleEditor.tsx`
- `supabase/functions/gmail-debug-refresh/index.ts`

**Edited files**
- `supabase/functions/_shared/gmail.ts`, `gmail-send`, `gmail-list-threads`, `gmail-get-thread`, `gmail-modify`, `gmail-disconnect`, `gmail-oauth-callback` (multi-account support)
- `src/pages/IntegrationsGmailPage.tsx` (multi-account list UI)
- `src/components/inbox/ComposeModal.tsx`, `ComposePanel.tsx` (From dropdown)
- `src/pages/InboxPage.tsx` (account filter + indicator)
- `src/components/AppSidebar.tsx` (Help footer item, Developer link gated)
- `src/App.tsx` (new routes + guard)
- `src/hooks/useGmailAccess.ts` (return list of accounts, not a single one)

**Open question for you to answer during build:** what's the support email for the mailto link?
