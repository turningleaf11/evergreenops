# Plan: Multi-Gmail, Developer Page, Help Center, OAuth Fix

## Status: ✅ COMPLETE

### Backend
- DB: `gmail_workspace_account` got `label` + `is_default` (one default per workspace).
- DB: `scheduled_emails` got `account_id` (nullable FK → connected account, ON DELETE SET NULL).
- DB: `help_articles` table + RLS (anyone reads published, only Evergreen HQ admins write).
- DB: `is_developer_workspace_admin()` SQL helper, hardcoded to Evergreen HQ.
- Edge: `_shared/gmail.ts` per-account targeting + fan-out helpers.
- Edge: `gmail-oauth-callback` adds NEW account row instead of overwriting.
- Edge: `gmail-disconnect` accepts `{ account_id }`; auto-promotes new default.
- Edge: `gmail-send` accepts `account_id`.
- Edge: `gmail-list-threads` supports `?account_id=all` fan-out.
- Edge: `gmail-debug-refresh` (developer-only).
- Edge: `scheduled-email-dispatch` honors per-row `account_id`, falls back to default.

### Frontend
- `src/lib/developer.ts` — `DEVELOPER_WORKSPACE_ID`, `SUPPORT_EMAIL`
  (`support@orrahq.com`), `useIsDeveloperWorkspace()`.
- `useGmailAccess` exposes `accounts[]` + `defaultAccount`.
- `/settings/developer` (Evergreen HQ primary admin only) — workspace info + per-account "Refresh token" button.
- `/help` — searchable categorized articles, admin (Evergreen HQ only) editor, "Contact support" → mailto.
- `IntegrationsGmailPage` — multi-account list, "Connect Gmail" adds another, inline rename, "Make default", per-account disconnect.
- `ComposePanel` + `ComposeModal` — "From" dropdown (only when 2+ accounts) → passes `account_id` to `gmail-send` / `scheduled_emails`.
- `InboxPage` — "From: All accounts ▾" filter chip (only when 2+ accounts), per-thread account label badge when filter = all.
- `AppSidebar` footer — Help icon (everyone) + Developer icon (gated).

### OAuth note
- 403 in **preview** = `id-preview--*.lovable.app` not on Google's allowed list.
  Use the **published** URL `https://evergreenops.lovable.app` to connect new
  Gmail accounts. Code is correct.
