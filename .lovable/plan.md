# Unify CRM detail sheets

Goal: Leads, Contacts, Deals, Transactions, and Companies detail sheets read as siblings — same shell, same identity strip, same tabs, same status pills — without changing what they do.

## Approach

Build a small set of shared layout primitives, then refactor each existing sheet to render through them. Functionality, data, fields, and behaviors stay 1:1 with today.

## Shared primitives (new files in `src/components/crm/_shell/`)

1. `EntitySheetShell.tsx` — opinionated `Sheet` + `SheetContent` wrapper. Fixed width, fixed padding, scroll behavior, loading state.
2. `EntitySheetHeader.tsx` — title, subtitle, prev/next arrows (optional via prop), close button, action menu slot. Same typography on every entity.
3. `EntityIdentityStrip.tsx` — single horizontal row directly under the header, in fixed order: `Owner picker → Status pill → contextual chips slot`.
4. `EntityStatusPill.tsx` — one badge component reading from a shared color registry so Lead temperature, Contact type, Deal stage, Transaction lane, and Company tier all render identically.
5. `EntitySectionHeader.tsx` — uppercase tracker label used between sections inside tabs.
6. `EntityTabs.tsx` — wrapper around shadcn `Tabs` with a fixed list style and consistent active-tab treatment.

## Standard tab set (every entity)

Every detail sheet uses the same four tabs in the same order:

```text
Overview · Activity · Files · More
```

- `Overview` — entity-specific fields (today's main body content, restyled with `EntitySectionHeader`).
- `Activity` — `CrmActivityTimeline` + composer (whichever composer the entity already uses).
- `Files` — entity's existing files panel; for entities without one yet (Contact, Transaction, Company) show a clean empty state, no new functionality.
- `More` — entity-specific extras that don't fit elsewhere (e.g. Deal Underwriting, Lead BuyBox/DocChecklist, Transaction key-dates detail). Hidden when empty.

## Per-entity refactor (visual only)

For each sheet, replace its current shell + header + identity row with the shared primitives, then move existing body content into the standard tabs. No fields added, removed, or renamed.

- `LeadPeekSheet` — drop custom header/X/arrows, move BuyBox + DocChecklist into `More`, keep Properties content in Overview.
- `ContactPeekSheet` — wrap existing single-scroll body into Overview tab, lift composer into Activity tab.
- `DealPeekSheet` — keep existing tabs but rename/reorder to standard set; Underwriting moves into `More`.
- `TransactionDetailSheet` — wrap existing scroll into Overview; key-dates strip stays at top of Overview.
- `CompanyPeekSheet` (new file) — built directly on the primitives. Pulls fields already shown in `CompaniesTable` row + a minimal Activity tab. Wired into `CompaniesTable` row click. No new backend.

## Color & status alignment

Create `src/components/crm/_shell/statusRegistry.ts` consolidating today's scattered color maps (`STATUS_COLOR` in Contact, `TX_LANE_COLOR`/`TX_STATUS_COLOR` in Transactions, `TEMPERATURE_META` in Leads, deal stage colors). Existing colors are preserved — just moved to one file so `EntityStatusPill` can render them uniformly.

## What does NOT change

- No data model or query changes.
- No edge function changes.
- No new fields, no removed fields.
- No change to dialogs (NewLead, NewContact, NewDeal, NewTransaction).
- No change to list/kanban pages.
- No routing changes.

## Technical notes

- All primitives use semantic Tailwind tokens (no hard-coded colors).
- Keep current file names for the four existing sheets so imports don't break; refactor in place.
- Tabs default to `Overview` on open for every entity (matches Deal today).
- Header prev/next arrows only render when the parent passes `onPrev`/`onNext` (Lead has them today; others can opt in later).
- `EntitySheetShell` width: `w-full sm:max-w-[640px]` standardized across all five.

## Rollout order

1. Build primitives + status registry.
2. Refactor `ContactPeekSheet` first (simplest, validates the primitives).
3. Refactor `TransactionDetailSheet`.
4. Refactor `DealPeekSheet`.
5. Refactor `LeadPeekSheet` (most custom chrome, biggest diff).
6. Build `CompanyPeekSheet` and wire into `CompaniesTable`.

Each step is independently shippable and visually verifiable.
