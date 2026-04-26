# Plan: Multi-Gmail, Developer Page, Help Center, OAuth Fix

## Status: PARTIAL — backend done, UI pending

### ✅ Completed in this turn

**Database (migration applied & live):**
- `gmail_workspace_account` got `label` (nickname) and `is_default` (only one per workspace).
- Backfilled existing accounts as default.
- New `help_articles` table with RLS — anyone signed in can read published articles, only Evergreen HQ admins (you) can edit/create/delete. Seeded 5 starter articles (Getting started, Connecting Gmail, Inviting team members, CRM basics, Scorecards).
- New `is_developer_workspace_admin(uuid)` SQL helper, hardcoded to Evergreen HQ workspace ID `2a918558-69fa-4d12-9b2d-fe59e0823997`.

**Edge functions (deployed):**
- `_shared/gmail.ts` — supports per-account targeting via `account_id` (query / body / `X-Gmail-Account-Id` header). Falls back to workspace default. New `listWorkspaceGmailAccounts` and `buildContextForAccount` helpers for fan-out.
- `gmail-oauth-callback` — connecting a new email creates a NEW account row (not an upsert that overwrites). Re-authing the same email rotates its token in place. First account auto-marked default.
- `gmail-disconnect` — accepts `{ account_id }` to remove one specific account; if none provided, removes all (back-compat). Auto-promotes a new default if you remove the current one.
- `gmail-send` — accepts `account_id` to choose which mailbox to send from. Returns the source account in the response.
- `gmail-list-threads` — supports `?account_id=all` to fan out across every connected account and merge results sorted by date. Each thread tagged with `account_id` / `account_email` / `account_label`.
- `gmail-debug-refresh` (NEW) — developer-only endpoint that force-refreshes a specific account's Google access token. Server-side gated to Evergreen HQ admins.

### ⏳ Remaining work (next turn)

**Multi-Gmail UI** (functional but not yet exposed):
- `useGmailAccess` hook updated to expose `accounts[]` and `defaultAccount`.
- Still needed:
  - `IntegrationsGmailPage` — list multiple accounts, "Connect another", inline label rename, default radio, per-account disconnect.
  - `ComposeModal` / `ComposePanel` — "From" dropdown that passes `account_id`.
  - `InboxPage` — "From: All accounts ▾" filter + per-thread account indicator when 2+ accounts connected.

**Developer page** (gating + page):
- `src/lib/developer.ts` with `DEVELOPER_WORKSPACE_ID` constant + `useIsDeveloperWorkspace` hook.
- `/settings/developer` route + guard in `App.tsx`.
- `DeveloperPage` with: system info, Gmail accounts debug panel (calls `gmail-debug-refresh`), edge function shortcuts.
- Sidebar "Developer" link gated on `useIsDeveloperWorkspace`.

**Help Center:**
- `/help` route.
- `HelpPage` with category sidebar + markdown viewer (`react-markdown`).
- `ArticleEditor` for admins (you).
- "Contact support" → `mailto:` button. Need your support email.
- Add `HelpCircle` to `AppSidebar` `SidebarFooter`.

**Docs:**
- `docs/gmail-oauth-setup.md` — Phase 1 (Test users) checklist + Phase 2 (Google verification submission) prep.

### Action you need to take TODAY (Phase 1 OAuth fix)

Independent of the code work — go do this now to unblock yourself:
1. Google Cloud Console → APIs & Services → OAuth consent screen.
2. Add your email under **Test users**. Save.
3. Confirm Gmail API is enabled (APIs & Services → Library).
4. Retry **Settings → Integrations → Gmail → Connect Gmail**.

### Open question

What's the support email address for the help center "Contact support" button?
(I'll plug it into `src/lib/developer.ts` next turn.)
