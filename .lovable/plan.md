## Goal

Allow new property leads to flow into the **CRM → Inbox (Leads)** tab from two sources:
1. **Public submission form** — shareable URL for brokers, wholesalers, or your own website.
2. **Inbound webhook** — secure HMAC-signed endpoint for GHL, Zapier, Make, email parsers, etc.

Both create a `leads` row, land in the inbox unassigned, and trigger a header-bell notification.

---

## What gets built

### 1. Database

Add a single table `lead_intake_sources` to track configured intake channels (form + webhook share the same model):

- `id`, `workspace_id`, `name` (e.g. "Broker Submissions", "GHL Pipeline")
- `kind` ('form' | 'webhook')
- `slug` (used in form URL: `/submit-lead/<slug>`)
- `secret` (HMAC secret for webhook signing)
- `active` (bool)
- `default_source_label` (auto-fills the lead's `source` field, e.g. "Public Form – Brokers")
- `field_config` (jsonb — which standard fields to show on the form, plus optional custom fields)
- `submission_count`, `last_submission_at`, `created_by`, `created_at`

RLS: workspace members read; admins manage. Public form endpoint reads via a SECURITY DEFINER helper using the slug — no auth required for submitters.

A lightweight `lead_intake_submissions` log table records each raw payload (for debugging + audit), 30-day retention.

No schema changes to `leads` itself — new leads just land with `status = 'new'`, `owner_id = null`, and `source` populated.

### 2. Public submission form

**Route:** `/submit-lead/:slug` (no auth, similar to existing `/forms/:id` pattern)

**Fields** (matching your standardized property model):
- Property Address, City, State, Zip
- Property Type (dropdown), Units, Unit Mix, Sqft, Asking Price
- Submitter contact: Name, Email, Phone, Company
- Notes (free text)
- Optional file upload (OM, T12, Rent Roll → stored in `files` bucket, attached as lead files)

Clean, branded, mobile-friendly. Honeypot field + simple rate limit (60/min per IP) to deter spam. Success screen confirms submission.

### 3. Inbound webhook

**Endpoint:** `POST /functions/v1/lead-webhook-in/<slug>`

**Auth:** HMAC-SHA256 signature in `X-Lovable-Signature` header (same pattern as existing `list-webhook-in`).

**Body:** flexible JSON — accepts standard field names directly, or a `values` wrapper. Unknown fields go into `custom_fields`.

Returns the created lead `{ ok: true, lead: {...} }`.

### 4. Settings UI — "Lead Intake" section

New tab in **Settings → CRM** (or under existing CRM Custom Fields area) where admins can:
- Create/rename/disable intake sources
- Copy the public form URL
- Copy the webhook URL + reveal the signing secret
- See a sample cURL for the webhook
- View recent submissions log (last 50, with payload preview)

### 5. Inbox surfacing

- New leads appear in `LeadsList` immediately (already real-time via existing query patterns).
- Header bell notification fires for each new inbound lead (uses existing `activity_notifications` plumbing).
- Lead row shows a small badge with the source label (e.g. "Form" / "Webhook") so triage knows where it came from.

---

## Technical details

**Edge functions:**
- `lead-form-submit` (public, `verify_jwt = false`) — accepts form POST, validates with Zod, inserts lead.
- `lead-webhook-in` (public, `verify_jwt = false`) — validates HMAC, inserts lead.

Both share helper logic for: looking up the intake source by slug, mapping payload → `leads` columns, populating `source`, logging to `lead_intake_submissions`, and emitting an activity notification.

**Validation (Zod):** address required; email format if provided; numeric coercion for units/sqft/price; max lengths on all text fields; reject if intake source is inactive or workspace mismatch.

**Security:**
- Form endpoint: rate-limited per IP, honeypot, no auth needed.
- Webhook endpoint: HMAC required, rate-limited per slug.
- Both use SERVICE_ROLE only inside the edge function; raw client never touches the DB directly.

**Files (form uploads):** uploaded to `files` bucket under `lead-intake/<lead_id>/`, then linked via existing lead files mechanism.

---

## Out of scope for this round

- Custom REST API with bearer tokens (can add later if needed).
- Round-robin assignment (you chose unassigned-to-inbox).
- Email-to-lead parsing (would need a Mailparser/Zapier hop into the webhook — works today via webhook, no extra build).

---

## Deliverables

1. Migration: `lead_intake_sources` + `lead_intake_submissions` tables with RLS.
2. Edge functions: `lead-form-submit`, `lead-webhook-in`.
3. Public page: `/submit-lead/:slug` (clean branded form).
4. Settings UI: Lead Intake management panel.
5. Inbox: source badge on lead rows + bell notification on new inbound.
