# Plan: Multi-Gmail, Developer Page, Help Center, OAuth Fix

## Status: UI MOSTLY DONE — only Compose/Inbox surfaces left

### ✅ Completed previously (backend)
- DB: `gmail_workspace_account` got `label` + `is_default` (one default per workspace).
- DB: `help_articles` table + RLS (anyone reads published, only Evergreen HQ admins write).
- DB: `is_developer_workspace_admin()` SQL helper, hardcoded to Evergreen HQ.
- Edge: `_shared/gmail.ts` per-account targeting + fan-out helpers.
- Edge: `gmail-oauth-callback` → adds NEW account row instead of overwriting.
- Edge: `gmail-disconnect` → accepts `{ account_id }`; auto-promotes new default.
- Edge: `gmail-send` → accepts `account_id`.
- Edge: `gmail-list-threads` → `?account_id=all` fan-out.
- Edge: `gmail-debug-refresh` (developer-only token refresh).
- Hook: `useGmailAccess` exposes `accounts[]` + `defaultAccount`.

### ✅ Completed this turn (UI)
- `src/lib/developer.ts` — `DEVELOPER_WORKSPACE_ID`, `SUPPORT_EMAIL`
  (`support@orrahq.com`), `useIsDeveloperWorkspace()`.
- `src/pages/DeveloperPage.tsx` (`/settings/developer`):
  - Hard-gated to Evergreen HQ primary admin.
  - Shows workspace + user IDs.
  - Lists Gmail accounts with one-click "Refresh token" → `gmail-debug-refresh`.
  - Quick links.
- `src/pages/HelpPage.tsx` (`/help`):
  - Search + categorized article sidebar.
  - Markdown article viewer (plain `<pre>` for now — can swap to `react-markdown` later).
  - Admin (Evergreen HQ only) can create / edit / delete articles via dialog.
  - "Contact support" button → `mailto:support@orrahq.com`.
- `src/pages/IntegrationsGmailPage.tsx` rewritten:
  - Lists ALL connected accounts.
  - "Connect Gmail" button always visible (adds another, no overwrite).
  - Inline rename (label) per account.
  - "Make default" + "Disconnect" per account.
  - Default account shown with star badge.
  - Access rules unchanged (still apply workspace-wide).
- `src/components/AppSidebar.tsx`:
  - Help icon (`HelpCircle`) added to footer cluster → `/help`.
  - Developer icon (`Code2`) added to footer, gated on
    `useIsDeveloperWorkspace() && isPrimaryAdmin`.
- `src/App.tsx` — routes for `/settings/developer` and `/help`.

### ⏳ Still on the plan (next turn)

**Compose `From` dropdown** — `src/components/inbox/ComposePanel.tsx` and any other compose entry points need a "From: …" select that defaults to `defaultAccount` and passes the chosen `account_id` to `gmail-send`. (Hidden when only one account.)

**Inbox "All accounts" filter** — `src/pages/InboxPage.tsx` needs:
- Header chip "From: All accounts ▾" (only shows when 2+ accounts).
- Pass `?account_id=all` (or specific id) to `gmail-list-threads`.
- Per-thread account indicator (small label/avatar) when filter = all.

**Optional polish:**
- Swap Help body renderer from `<pre>` to `react-markdown` for proper formatting.
- Help analytics (which articles viewed).
- Eventual support chat (currently mailto only — that was the agreed scope).

### OAuth note (resolved-ish)
- 403 in **preview** = `id-preview--*.lovable.app` not on Google's redirect / authorized domains list. Working on **published** URL `https://evergreenops.lovable.app` confirms code is correct. Use the live URL to add new accounts.
