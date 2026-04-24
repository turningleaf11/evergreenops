## Overview

Three connected upgrades to the CRM:

1. **Leads Inbox** — a pre-CRM staging area (Pipedrive-style) with cold/warm/hot temperature, quick "follow up later/tomorrow" actions, and one-click "Convert to deal".
2. **New Deal & Contact peek layout** — tabbed composer at top (Note / Email / Text / Log call), big activity timeline below, right-rail with Tasks, Collaborators, Appointments.
3. **Vertical activity timeline** — left-side icon rail with circular nodes (email, meeting, call, stage-change), matching the reference image.

---

## 1. Leads Inbox

### New tab in CRM
Add a 4th tab "Leads" (icon: `Inbox`) in `CrmPage.tsx`, route `/crm/leads`. Make it the leftmost tab so workflow reads Leads → Contacts → Companies → Deals.

### Database (`leads` table)
```
leads
  id, workspace_id, created_at, updated_at
  name, email, phone, company_name, title
  source           text   (e.g. "Web form", "Referral", "Cold outreach")
  temperature      text   (cold | warm | hot)   default 'warm'
  status           text   (new | working | qualified | converted | archived) default 'new'
  next_action_at   timestamptz   -- "follow up tomorrow" sets this
  notes            text
  owner_id         uuid → profiles.user_id
  created_by       uuid
  converted_contact_id  uuid → contacts.id
  converted_deal_id     uuid → deals.id
  custom_fields    jsonb default '{}'
```
RLS: same "Strict + linked" model — owner, creator, admins; team via deal once converted.

### Leads page UI
- **Toolbar**: search, filter by temperature (chip toggles 🔵 Cold / 🟠 Warm / 🔴 Hot), filter by owner, sort (newest / next action / temperature).
- **List view** (rows, not kanban — declutter intent):
  ```
  [🔴 Hot]  Jane Doe · Acme Corp           Source: Web form
            jane@acme.com · (555) 123-4567   Next: Tomorrow 9am
            [Follow up later ▾] [Qualify →] [Archive]
  ```
- **Quick actions per row**:
  - "Follow up later" → popover: Today 5pm / Tomorrow 9am / In 3 days / Next week / Custom — sets `next_action_at` and logs an activity.
  - "Qualify → Deal" → opens convert dialog (pre-fills contact + deal from lead fields, on save creates contact+deal, links `converted_*`, sets status='converted').
  - Temperature chip click cycles cold→warm→hot.
- **Lead peek sheet** (same pattern as Contact peek): details, notes log, activity timeline, "Convert to deal" CTA.
- **New lead dialog**: name, email, phone, company, source, temperature.

### Convert flow
On qualify: insert into `contacts` (or link existing if email matches), insert into `deals` (default pipeline, first stage), copy notes as a `crm_activities` note, set lead `status='converted'` + `converted_contact_id` + `converted_deal_id`. Show toast with link to new deal.

---

## 2. New Deal & Contact Peek Layout (matches reference image)

Refactor `DealPeekSheet.tsx` and `ContactPeekSheet.tsx` (or a shared `EntityPeekLayout`) to a wider sheet (`sm:max-w-4xl`) with two columns:

```text
┌────────────────────────────────────┬──────────────────────┐
│ [Note] [Email] [Text] [Log call]   │  Tasks               │
│ ┌────────────────────────────────┐ │   ☑ ───────          │
│ │ @ mention-aware composer       │ │   ☐ ───────          │
│ └────────────────────────────────┘ │   [+ Add task]       │
│                                    │                      │
│ All(127) ✉(1) 💬(22) 📞(1) ⚑(0)…   │  Collaborators       │
│                                    │   👤 Maria Curtis    │
│  ●─ activity timeline (see §3)     │   👤 James Culhane   │
│  ●─ ...                            │   [+ Invite]         │
│                                    │                      │
│                                    │  Appointments        │
│                                    │   ▬▬▬▬▬              │
└────────────────────────────────────┴──────────────────────┘
```

### Composer tabs (top)
A `Tabs` component with 4 modes:
- **Note** — current note textarea (with @mention support via existing `MentionExtension`).
- **Email** — opens `ComposeModal` with primary contact pre-filled.
- **Text** — logs an SMS activity (text body, no send for now; future Twilio hook).
- **Log call** — outcome dropdown (Connected / Voicemail / No answer) + note + duration.

Each tab submits to `crm_activities` with the right `type`.

### Activity filter pills
Below composer: `All (n)` `✉ Email (n)` `💬 Note (n)` `📞 Call (n)` `⚑ Task (n)` `🌡 Stage (n)` — clicking filters timeline. Counts derived from current activities.

### Right rail (~320px)
- **Tasks** — pull from existing `tasks` table where `entity_links` references this deal/contact (or new `crm_tasks`). Inline checkbox + "Add task" input.
- **Collaborators** — for deals: reuse `DealTeamMembersPanel`. For contacts: show owner + recent activity actors with "Add" link.
- **Appointments** — upcoming meetings from `crm_activities` where `type='meeting'` and `occurred_at >= now()`, plus a "Schedule" link.

### Stage changes as activities
Add a trigger: when `deals.stage_id` changes, insert a `crm_activities` row `type='stage_change'`, body `Stage: {new_stage_name}`.

---

## 3. Vertical Activity Timeline (matches reference)

Replace the current card-list timeline with a vertical rail:

```text
   ●  Stage: Contact Made              7 Dec 2022 · Maggie
   │
   ✉  Documents sent with proposal     7 Dec 2022 · Maggie
   │  (expandable email body…)
   │
   👥 Meeting scheduled                15 Dec 2022 · Maggie
   │
   ●  Stage: Lead Qualified            7 Dec 2022 · Maggie
```

### Component: `CrmActivityTimeline.tsx`
- Left gutter (~48px) renders a continuous vertical line + circular icon nodes.
- Icon per type: `note=NotebookPen` (amber), `email=Mail` (yellow), `call=Phone` (gray), `meeting=Users` (gray), `task=CheckCircle` (green when done), `stage_change=Circle` (gray dot, no card).
- Each card: subject (bold) + snippet, footer `{date} · {actor name}`.
- Stage-change rows render inline (no card), just `Stage: {name}`.
- Email cards keep Reply / open-in-inbox actions.
- Clickable to expand full body.

Used in both `DealPeekSheet` and `ContactPeekSheet`.

---

## Files

**New**
- `src/pages/CrmLeadsPage.tsx` (or extend `CrmPage` with leads tab)
- `src/components/crm/LeadsList.tsx`
- `src/components/crm/LeadPeekSheet.tsx`
- `src/components/crm/NewLeadDialog.tsx`
- `src/components/crm/ConvertLeadDialog.tsx`
- `src/components/crm/FollowUpPicker.tsx` (popover with quick presets)
- `src/components/crm/CrmActivityTimeline.tsx`
- `src/components/crm/CrmComposerTabs.tsx`
- `src/components/crm/PeekRightRail.tsx` (Tasks / Collaborators / Appointments blocks)
- Migration: `leads` table + RLS + stage-change trigger on `deals`

**Edited**
- `src/pages/CrmPage.tsx` — add Leads tab
- `src/components/crm/DealPeekSheet.tsx` — wider sheet, composer tabs, right rail, new timeline
- `src/components/crm/ContactPeekSheet.tsx` — same layout
- `src/App.tsx` — `/crm/leads` route already covered by `:tab` param
- `src/components/AppSidebar.tsx` — (optional) "Leads" sub-link under CRM

---

## Open question (assumed defaults)
- "Text" composer: log-only for now (no SMS provider). Will mark in UI as "Logs an SMS activity — Twilio coming soon."
- Tasks in right rail: use existing `tasks` table linked via `entity_links` (deal/contact). No new table.

If those defaults are wrong, tell me and I'll adjust before building.
