## Goal

Add a first-class **Contacts CRM** module that lives alongside Lists, Execution, and Inbox — with companies, deals/pipelines, activity timeline, and tight two-way integration with the existing Gmail inbox. Built so it feels native to Evergreen (not a generic CRM tab), reusing the Card-Enhanced List UI, peek views, RBAC, and the polymorphic `entity_links` pattern.

## What "full CRM" means here

Five pillars:

1. **Contacts** — people you do business with (sellers, buyers, agents, lenders, vendors).
2. **Companies** — organizations a contact belongs to.
3. **Deals + Pipelines** — opportunity tracking with customizable stages (you already have a "Deal Pipeline" template hint in the acquisitions domain).
4. **Activity Timeline** — calls, meetings, notes, tasks, and **emails** auto-logged per contact/deal.
5. **Email integration** — every Gmail thread to/from a contact's address shows up on their record automatically; you can send from inside a contact and it threads back into Inbox.

## On Gmail vs the new connector

You don't need both. Recommendation: **keep the current Gmail setup as the source of truth** for the Inbox (it's already wired with OAuth, tokens, list/get/send/modify functions, AI triage, label sync, and `email_links`). The new "Autumn's Google Mail" connector is a different account and uses the gateway pattern — it's better suited to **per-user mailboxes** later (e.g., each salesperson connects their own Gmail to log only their conversations). For v1, match on email address against the existing workspace mailbox; we can layer per-user mailboxes in v2.

## Data model (new tables)

```text
contacts                companies               deals
─ id                    ─ id                    ─ id
─ workspace_id          ─ workspace_id          ─ workspace_id
─ first_name            ─ name                  ─ title
─ last_name             ─ domain (unique key    ─ pipeline_id
─ full_name (computed)    for email matching)   ─ stage_id
─ email (indexed)       ─ industry              ─ value (numeric)
─ phone                 ─ website               ─ currency
─ title                 ─ address (jsonb)       ─ probability
─ company_id            ─ size                  ─ expected_close_date
─ owner_id (assignee)   ─ notes                 ─ owner_id
─ source                ─ owner_id              ─ primary_contact_id
─ tags (text[])         ─ tags                  ─ company_id
─ status (lead/active/  ─ created_at/by         ─ status (open/won/lost)
   customer/lost)                               ─ lost_reason
─ address (jsonb)                               ─ tags
─ social (jsonb)                                ─ created_at/by
─ last_contacted_at
─ created_at/by

pipelines               pipeline_stages         crm_activities
─ id                    ─ id                    ─ id
─ workspace_id          ─ pipeline_id           ─ workspace_id
─ name                  ─ name                  ─ entity_type (contact|deal|company)
─ is_default            ─ order                 ─ entity_id
─ created_by            ─ probability_default   ─ type (call|meeting|note|email|task)
                        ─ color                 ─ subject
                        ─ is_won / is_lost      ─ body
                                                ─ occurred_at
                                                ─ duration_minutes
                                                ─ actor_id
                                                ─ metadata (jsonb — gmail_thread_id, etc.)
```

- `email_links` already exists and links Gmail threads to entities — we'll reuse it for `entity_type='contact'` and `entity_type='deal'` so emails appear in the activity timeline without duplicating data.
- Deal ↔ Contact many-to-many (a deal can have multiple stakeholders) goes through `entity_links` (`source_type='deal'`, `target_type='contact'`).

All tables RLS-protected: workspace members read; admins manage; owners can update their own records (mirrors the patterns already in `cadences`, `content_library`, etc.).

## Auto-logging emails to contacts

A Postgres function + trigger:

- When a row is added to `email_links`, look up `contacts` whose `email` matches any party on the Gmail thread (sender/recipients are stored on the inbox side).
- Insert a `crm_activities` row of type `email` referencing the contact (and the deal if `email_links.entity_type='deal'`).
- Update `contacts.last_contacted_at`.

For the reverse direction (emails arriving in Inbox should "find" their contact even if not manually linked), add a small edge function step in `gmail-list-threads`/`gmail-get-thread` that, on first view of a thread, checks recipients against `contacts.email` and creates `email_links` automatically.

## UI surfaces

**1. New top-level nav item: "CRM"** (sits between Inbox and Lists; respects sidebar icon-accent active style)

```text
/crm                 → Contacts table (default)
/crm/contacts/:id    → Contact peek (Side/Center/Full)
/crm/companies       → Companies table
/crm/companies/:id   → Company peek with rolled-up contacts + deals
/crm/deals           → Deals — Kanban (default) or Table view
/crm/deals/:id       → Deal peek
/crm/pipelines       → Pipeline + stage management (admin)
```

**2. Contacts table** — reuses `DatabaseView`'s Card-Enhanced List UI:
- Columns: Name, Email, Phone, Company, Owner, Status pill, Last Contacted, Tags
- Inline-edit, Filter/Sort/Group toolbar, saved views (we already have `database_views` patterns to copy)
- Hover row → expand-to-peek button on the **left** of the title (matches the fix we just shipped)
- Bulk actions: assign owner, change status, add tag, delete

**3. Contact Peek** (Side/Center/Full):
- Header: avatar (initials chip with department color), name, title, company link, owner badge
- Quick-action row: Email, Call, Log Activity, Add to Deal
- Tabs: **Overview** (fields) · **Activity** (unified timeline of emails + notes + calls + tasks, newest first) · **Deals** · **Files** · **Comments** (reuses existing threaded comments)
- Right rail: related Lists rows linked via `entity_links`, recent emails (live from `email_links`)

**4. Deals Kanban** — same engine as the existing project Kanban:
- Columns = stages of the active pipeline (toggleable in header)
- Cards show title, value, primary contact avatar, days-in-stage, owner
- Drag to move stage; "won/lost" stages prompt for `lost_reason`
- Forecast strip at top: total open value, weighted (value × probability), close-this-month

**5. Email integration touchpoints**
- **In Inbox**: existing thread detail gets a "Linked to" section showing matched contact/deal with quick "Add to Deal" action (extends current `email_links` UI — see `ThreadDetail.tsx`).
- **In Contact peek → Activity tab**: each email row is clickable and opens the Gmail thread in the Inbox detail panel without leaving the page.
- **Send from contact**: the existing `ComposeModal` opens prefilled with `to: contact.email`; on send (`gmail-send`), we insert an `email_links` row tagged to that contact, which the trigger turns into a `crm_activities` entry.

## Permissions

- Same RBAC as the rest of the app: members see contacts/deals in their assigned department(s) plus ones they own; admins see everything.
- `contacts.department_id` (optional) so dept-scoped visibility works the same way Docs/Lists do.
- "Owner" defaults to creator and is reassignable by admins or the current owner.

## What changes elsewhere

- **AppSidebar**: add CRM nav item with Users/Briefcase icon.
- **Global Quick Create**: add "Contact" and "Deal" entries.
- **Global Search**: extend `universal-search` edge function to include contacts/companies/deals.
- **Mention picker**: `@` should match contacts so notes/comments can reference them.
- **CEO Cockpit**: optional widget for "Deals closing this week" (same pattern as TodaysPriorities).

## Phasing (so it ships incrementally)

- **Phase 1 — Foundation** (1 migration + Contacts table + peek): contacts/companies tables, RLS, `/crm` route, table view, peek with Overview + Comments + Activity (notes only).
- **Phase 2 — Deals & Pipelines**: pipelines/stages/deals tables, Kanban board, Deal peek, contact↔deal linking via `entity_links`.
- **Phase 3 — Email integration**: trigger + auto-matching, "Linked to" UI in Inbox, send-from-contact, activity timeline shows emails.
- **Phase 4 — Polish**: forecast strip, bulk actions, saved views, global search inclusion, mention support, CEO widget.

## Out of scope (call out explicitly)

- Multi-user per-mailbox Gmail (everyone uses the workspace mailbox in v1; the new connector is reserved for v2 per-rep mailboxes).
- Automated email sequences / drip campaigns.
- Calling integration (Twilio etc.) — call activities are manual entries for now.
- Lead scoring / AI deal coaching (good Phase 5 candidate using the existing AI gateway).
