# CRM: Unified Create + Email From Anywhere + Multi-Contact Deals

Four connected improvements to make the CRM feel like a real CRM rather than disconnected forms.

## 1. Quick-Create: Contact AND Deal in one shot

Replace the tabbed Contact/Deal switcher in `QuickCreateDialog` with a single form that can create both at once.

New layout:
- **Contact section** (always shown): first/last/email/phone/title + custom fields
- **"Also create a deal for this contact"** toggle (Switch) — off by default
- When enabled, expands to: deal title (auto-prefilled `"<Name> – New deal"`), value, pipeline, stage + deal custom fields

On submit:
- Insert contact (if any contact field filled). If contact-only, behave as today.
- If deal toggle is on, insert deal with `primary_contact_id = newContact.id` and add an `entity_links` row (`source_type='deal' → target_type='contact'`).
- `onCreated` callback fires for both records so `LinkToCrm` auto-links the email thread to BOTH the contact and the deal.

`LinkToCrm` quick-create section becomes a single button: **"+ Add to CRM"** (the in-dialog toggle replaces the two separate buttons).

## 2. Reply to a contact from the activity timeline

In `ContactPeekSheet` and `DealPeekSheet`, the "Open" link on email activities currently jumps to the inbox. Add inline actions instead:

- **Reply** button → opens existing `ComposeModal` prefilled with:
  - `defaultTo` = matched participant email (contact's email for contact peek; deal's primary contact for deal peek)
  - `defaultSubject` = `"Re: <original subject>"`
  - `threadId` + `inReplyTo` from the activity metadata so Gmail threads it correctly
- Keep **Open in inbox** as a secondary icon-only link
- After send (`onSent`), refresh the activity list

This requires storing the original Gmail `message_id` on the activity. The `crm_mirror_email_link` trigger already writes `gmail_message_id` into `metadata` — use it as `inReplyTo`.

## 3. Send a brand-new email from inside a Deal (auto-linked)

Add an **Email** button to `DealPeekSheet` header.

Flow:
1. Click → opens `ComposeModal`
2. If deal has multiple linked contacts, show a small recipient picker first (checkboxes pre-checked for primary contact); selected emails join into the To field
3. After `gmail-send` succeeds, the function returns the new `threadId` — extend `gmail-send` edge function to return `{ threadId, messageId }`
4. Client inserts an `email_links` row for every linked contact AND for the deal itself
5. Trigger auto-mirrors into `crm_activities`, so the new thread appears in the deal timeline immediately

Same pattern is added to `ContactPeekSheet` as a "New email" button (single recipient = the contact).

## 4. Multiple contacts per deal (primary + associated)

Schema: `deals.primary_contact_id` already exists. Associated contacts already use `entity_links`. Add UI to manage them.

Update `DealPeekSheet` "Linked contacts" section:
- Display contacts grouped: a labeled "Primary" card on top, then "Associated" rows
- Each associated row has a **"Make primary"** action (swaps `primary_contact_id`) and an **unlink** (X) action
- **+ Add contact** button → small popover with:
  - Search existing contacts (ilike on name/email, limit 8)
  - "Create new contact" → opens `QuickCreateDialog` in contact-only mode, then auto-links on creation
- Selecting/creating a contact:
  - If deal has no primary yet → set as `primary_contact_id`
  - Otherwise → insert into `entity_links` (deal → contact)

`NewDealDialog` is updated symmetrically: allow picking 1 primary contact + N associated contacts during creation.

## Technical notes

**Files to edit**
- `src/components/crm/QuickCreateDialog.tsx` — combined form, optional deal toggle, dual onCreated
- `src/components/inbox/LinkToCrm.tsx` — collapse two buttons into one
- `src/components/crm/DealPeekSheet.tsx` — Email button, contact manager (primary swap, add, remove), inline Reply on activities
- `src/components/crm/ContactPeekSheet.tsx` — Email button + inline Reply on activities
- `src/components/crm/NewDealDialog.tsx` — multi-contact picker
- `src/components/inbox/ComposeModal.tsx` — accept `onAfterSend(threadIdMessageId)` callback
- `supabase/functions/gmail-send/index.ts` — return `{ threadId, messageId }` from Gmail's response

**No schema changes required** — `entity_links`, `deals.primary_contact_id`, `email_links`, and the mirroring trigger already cover all four features.

**Edge case**: when a contact is unlinked from a deal where it's the primary, prompt to either pick a new primary from associated contacts or clear `primary_contact_id`.
