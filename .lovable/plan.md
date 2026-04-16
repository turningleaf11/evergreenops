
User shifted Gmail to **per-workspace** with **admin-controlled per-user/role access**. Drop per-user OAuth as the connection model — connection is workspace-level, gating is role/user-level.

# Plan

## Part 1 — Sidebar Pinned Mode
- Pin/unpin button in sidebar footer (pin icon)
- `localStorage["sidebar-mode"]` = `"pinned" | "floating"` (default `floating`)
- **Pinned**: sidebar renders inline as flex child of Layout, pushes content right, no overlay, no auto-collapse
- **Floating**: current overlay behavior preserved
- Files: `AppSidebar.tsx`, `Layout.tsx`

## Part 2 — Gmail Integration (workspace-level, admin-gated)

### Connection model
- **One Gmail account per workspace** (e.g. `ops@evergreenrev.com`) connected by an admin
- Admin authorizes once via Google OAuth → refresh token stored in Supabase Vault, keyed by `workspace_id`
- All emails sent/received flow through that shared mailbox
- (Future option: hybrid mode allowing per-user mailboxes — out of scope for v1)

### Admin access controls
New **Settings → Integrations → Gmail** page (admin only):
- **Connection panel**: "Connect Gmail" button → OAuth flow → shows connected email + Disconnect
- **Access panel** (visible after connection):
  - Toggle: "Allow all admins" (default on)
  - Toggle: "Allow all members" (default off)
  - Per-user allowlist: multi-select of workspace members granted access
  - Per-role: checkboxes for `admin` / `user` roles
- Saved to `gmail_access_rules` table

### Schema (one migration)
- `gmail_workspace_account` — `id, workspace_id (unique), email, refresh_token_secret_id (Vault ref), connected_by, connected_at, revoked_at`
  - RLS: admins of workspace can read/manage; non-admins cannot see token ref
- `gmail_access_rules` — `workspace_id (unique), allow_all_admins bool, allow_all_members bool, allowed_user_ids uuid[], allowed_roles text[]`
  - RLS: admins manage; all authenticated can read (UI needs it to know if they have access)
- `email_links` — polymorphic: `gmail_message_id, gmail_thread_id, entity_type, entity_id, linked_by, workspace_id`
  - RLS: workspace-scoped read; creator can delete

New helper SQL function: `can_use_gmail(_user_id uuid)` — checks role + allowlist; used by frontend hook + edge functions for authorization.

### Edge functions (all check `can_use_gmail` before acting)
- `gmail-oauth-start` — admin only; returns Google authorize URL
- `gmail-oauth-callback` — admin only; stores workspace refresh token in Vault
- `gmail-list-threads` — list folder using workspace mailbox
- `gmail-get-thread` — full thread with bodies
- `gmail-send` — send/reply (handles `In-Reply-To` threading); records `sent_by_user_id` in metadata so audit trail is preserved
- `gmail-modify` — read/unread/archive/star
- `gmail-disconnect` — admin only; revokes token, clears Vault entry

### Frontend
- `src/hooks/useGmailAccess.ts` — returns `{ connected, hasAccess, isAdmin }`
- `src/pages/InboxPage.tsx` — folder list / thread list / thread detail / compose
  - If `!connected`: empty state → "Ask an admin to connect Gmail"
  - If `connected && !hasAccess`: "You don't have access to the team inbox"
- `src/pages/IntegrationsGmailPage.tsx` — admin-only Connect/Disconnect + Access controls UI
- `src/components/inbox/` — `ThreadList`, `ThreadDetail`, `ComposeModal`, `LinkEmailButton`
- Sidebar **Inbox** item visible only when `hasAccess === true`
- Header unread badge (only when `hasAccess`)
- "Link email to record" button on Project / Task / Deal detail (only when `hasAccess`) → writes to `email_links`; activity feed renders linked threads

### Secrets needed (will request after approval)
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `GOOGLE_OAUTH_REDIRECT_URI` → `https://evergreenops.lovable.app/integrations/gmail/callback`

## Build Order
1. Sidebar pinned mode
2. Migration: `gmail_workspace_account`, `gmail_access_rules`, `email_links`, `can_use_gmail()` function
3. Settings → Integrations → Gmail (admin Connect + Access UI)
4. OAuth edge functions
5. Inbox UI + list/get/send/modify edge functions
6. Link-to-record + activity feed integration

## Whiteboard (still pending — needs your input before planning)
1. Where should boards live: per-department, per-project, or standalone "Boards" hub?
2. Solo-first or real-time multi-user collab from day one?
