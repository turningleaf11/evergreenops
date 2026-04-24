---
name: CRM Module
description: Contacts, companies, deals/pipelines, and activity timeline with Gmail integration via email_links
type: feature
---
First-class CRM module at `/crm/:tab` (contacts | companies | deals).

**Tables**: `contacts`, `companies`, `pipelines`, `pipeline_stages`, `deals`, `crm_activities`. All workspace-scoped, RLS: members view, creators/owners/admins manage. Default "Acquisitions Pipeline" seeded with stages New Lead → Contacted → Negotiating → Under Contract → Closed Won/Lost.

**Activity timeline**: `crm_activities` is polymorphic (`entity_type` + `entity_id`) covering note/call/meeting/email/task. Trigger `crm_bump_contact_last_contacted` auto-updates `contacts.last_contacted_at` on email/call/meeting activity.

**Email integration plan**: reuse existing `email_links` table — match Gmail thread participants against `contacts.email`, log to `crm_activities` as type='email'. Phase 3 work; Phase 1 ships Contacts/Companies tables, Deals Kanban, and manual note logging.

**UI**: `src/pages/CrmPage.tsx` (tabs shell), `src/components/crm/{ContactsTable, CompaniesTable, DealsKanban, ContactPeekSheet, NewContactDialog}.tsx`. Sidebar entry uses `Briefcase` icon, sits right after Inbox in workNav.

**Gmail decision**: keep existing custom OAuth flow (`gmail_tokens`, `gmail-*` edge functions, `useGmailAccess`) as the workspace mailbox source of truth. The new "Autumn's Google Mail" workspace connector is reserved for v2 per-user mailboxes.
