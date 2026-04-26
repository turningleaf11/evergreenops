## Goal

Make Lead rows on `/crm/leads` open a large right-side popup that mirrors the reference screenshot — a two-column layout with a structured details rail on the left and a tabbed Notes/Activity/Email panel on the right, plus a sticky action footer with **Convert to deal**.

## UX overview

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ [×] [▲][▼]   Rite Aid                                            [⠿⠿]  │  ← header (close, prev/next, name, layout)
├──────────────────────┬───────────────────────────────────────────────────┤
│ DETAILS              │  [Notes] [Activity] [Email]                       │
│  🏷  COLD            │  ─────────────────────────────────────────────    │
│  💰  Value           │  Click here to add a note…                        │
│  📅  Expected close  │                                                   │
│  👤  Owner           │           — PLANNED —                             │
│  ⬇  Source           │   You have no upcoming activities.                │
│                      │   ┌───────────────────────────────────────┐       │
│ PERSON       ⋯  ⇕    │   │ ☎ ▾  Call                              │      │
│  👤 Tyson Hebert     │   │ [In 1h][In 3h][Tomorrow][Next week] +  │      │
│  ✉  email (Work)  ✎  │   └───────────────────────────────────────┘      │
│  ☎  phone  (Work)    │                                                   │
│  📍 Country          │           — DONE —                                │
│                      │   • Lead created — Oct 19, 2022 · Oksana K        │
│ ORGANIZATION ▾      │                                                   │
├──────────────────────┴───────────────────────────────────────────────────┤
│ [⋯]  [🗄 Archive]                                  [ Convert to deal ]  │  ← sticky footer
└──────────────────────────────────────────────────────────────────────────┘
```

## Behavior

- Clicking anywhere on a lead row (except the inline action buttons) opens the peek for that lead. Action buttons (Follow up / Qualify / Archive) keep working inline via `e.stopPropagation`.
- Header arrows step prev/next through the currently filtered lead list without closing.
- Right column tabs:
  - **Notes** — quick add-a-note input that creates a `crm_activities` entry of type `note` against `entity_type='lead'`.
  - **Activity** — full timeline (notes, calls, meetings, stage/temperature/status changes, lead-created system entry).
  - **Email** — list of email activities; "New email" opens existing `ComposeModal` when the lead has an email.
- Planned section: lists future-dated meetings/calls/follow-ups. Below it, an inline "log activity" composer with a type dropdown (Call / Meeting / Email / Task) and quick chips **In 1h / In 3h / Tomorrow / Next week / + Other** that set `next_action_at` and create a planned activity in one click.
- Done section: reverse-chrono timeline of completed activities + system events.
- Left rail sections (collapsible):
  - **Details**: Temperature chip (click to cycle), Value, Expected close date, Owner (uses existing `OwnerPicker`), Source. Editable inline.
  - **Person**: name, email (with Work/Home label + edit pencil), phone, country. Pulled from the lead record.
  - **Organization**: company name, website, size — collapsed by default.
- Sticky footer: overflow `⋯` (delete, duplicate), Archive icon button, primary **Convert to deal** which reuses the existing `ConvertLeadDialog`. If the lead is already converted, footer shows **Open deal** instead.
- Closing: clicking the X, pressing Esc, or clicking outside closes the sheet.

## Technical changes

**New file:** `src/components/crm/LeadPeekSheet.tsx`
- Built on shadcn `Sheet` with `side="right"` and `className="w-full sm:max-w-5xl p-0 flex flex-col"`.
- Props: `lead: Lead | null`, `leads: Lead[]` (for prev/next), `onClose()`, `onChanged()`, `onConvert(lead)`.
- Internal state: active tab, activities list, people list (for actor names in timeline), draft note, planned-activity composer state.
- Loads `crm_activities` filtered by `entity_type='lead'` and `entity_id=lead.id` on open and after each insert.
- Reuses:
  - `CrmActivityTimeline`, `ActivityFilterPills` from `./CrmActivityTimeline`.
  - `OwnerPicker` from `./PeoplePickers`.
  - `ComposeModal` from `@/components/inbox/ComposeModal`.
  - `FollowUpPicker` from `./FollowUpPicker` for the "+ Other" custom date.
  - `ConvertLeadDialog` triggered via `onConvert` callback so the parent owns dialog stacking.

**Edit:** `src/components/crm/LeadsList.tsx`
- Add `const [openLead, setOpenLead] = useState<Lead | null>(null)`.
- Make each lead row clickable with `onClick={() => setOpenLead(l)}`. Add `onClick={(e) => e.stopPropagation()}` to the temp chip and the right-side action group so they keep working in place.
- Render `<LeadPeekSheet lead={openLead} leads={filtered} onClose={() => setOpenLead(null)} onChanged={() => setRefreshKey(k=>k+1)} onConvert={(l) => setConvertLead(l)} />` at the bottom.
- Keep the existing `ConvertLeadDialog` mount; `onConvert` just sets `convertLead` so the existing flow is reused untouched.

**Schema note:** the rail surfaces `value` and `expected_close_date` which aren't on `leads` today. The UI renders them as "—" with inline edit affordances; persistence can be added in a follow-up migration. No schema changes in this pass.

## Out of scope

- Lead custom fields (would need a `lead` entity in `crm_custom_fields`).
- Drag-resize of the peek panel.
- Bulk actions from the peek footer.