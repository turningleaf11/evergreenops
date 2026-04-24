---
name: CRM Module
description: Contacts, companies, deals/pipelines, and activity timeline with Gmail integration via email_links
type: feature
---
First-class CRM module at `/crm/:tab` (contacts | companies | deals).

**Tables**: `contacts`, `companies`, `pipelines`, `pipeline_stages`, `deals`, `crm_activities`. All workspace-scoped, RLS: members view, creators/owners/admins manage. Default "Acquisitions Pipeline" seeded with stages New Lead → Contacted → Negotiating → Under Contract → Closed Won/Lost.

**Activity timeline**: `crm_activities` is polymorphic (`entity_type` + `entity_id`) covering note/call/meeting/email/task. Trigger `crm_bump_contact_last_contacted` auto-updates `contacts.last_contacted_at` on email/call/meeting activity.

**Email integration plan**: reuse existing `email_links` table — match Gmail thread participants against `contacts.email`, log to `crm_activities` as type='email'. Phase 3 work; Phase 1 ships Contacts/Companies tables, Deals Kanban, and manual note logging.

**UI**: `src/pages/CrmPage.tsx` (tabs shell), `src/components/crm/{ContactsTable, CompaniesTable, DealsKanban, ContactPeekSheet, DealPeekSheet, NewContactDialog, NewDealDialog, QuickCreateDialog, CustomFieldsRenderer}.tsx`. Sidebar entry uses `Briefcase` icon, sits right after Inbox in workNav.

**Quick-create**: `QuickCreateDialog` always creates a contact; an "Also create a deal" Switch optionally creates a linked deal in the same submit (sets `primary_contact_id` and inserts an `entity_links` row). `LinkToCrm` in the inbox uses it to add records and auto-link the email thread.

**Multi-contact deals**: `deals.primary_contact_id` is the single primary; additional contacts are tracked via `entity_links` (source=deal → target=contact). DealPeekSheet manages add/unlink/make-primary; NewDealDialog supports picking 1 primary + N associated at create time.

**Email from peek sheets**: ContactPeekSheet and DealPeekSheet have a "New email" button using `ComposeModal`; activity-row "Reply" reuses the same modal with `threadId` for Gmail threading. After send, the client inserts `email_links` for the deal + every recipient contact (de-duped), and the `crm_mirror_email_link` trigger auto-mirrors into `crm_activities` so the thread shows on every related timeline.

**Gmail decision**: keep existing custom OAuth flow (`gmail_tokens`, `gmail-*` edge functions, `useGmailAccess`) as the workspace mailbox source of truth.
