# Lead detail polish: name title, card sidebar, no-pencil auto-save

Three small, scoped changes to `src/components/crm/LeadPeekSheet.tsx` (and one tiny CSS tweak). No data changes, no schema changes.

## 1. Header title = property/lead name, address as subtitle

Currently the header shows `company_name || lead.name` as title and the lead name as subtitle.

Change to:
- **Title** = `lead.name` (e.g. "Wisteria RV Park")
- **Subtitle** = `lead.property_address` (e.g. "1234 Cypress Way, Tampa, FL")

If there's no name, fall back to property_address; if neither, "Untitled lead".

## 2. Remove the cold/warm/hot labels

- Delete the temperature pill button row from the Details section.
- Remove the now-unused `TEMPS`, `cycleTemp`, and `meta`/`TEMPERATURE_META` reference inside the lead peek (the constant is still imported elsewhere from `FollowUpPicker`, so we just stop using it locally).
- Field stays in the schema (no migration). Existing values remain untouched.

## 3. Move Source and Added to the bottom of the left rail

Reorder the left-rail sections to:

1. **Person** card (name, email, phone)
2. **Organization** card (collapsible, company name)
3. **Property** card (address, type, units, beds/baths, sqft, pricing) — already its own card
4. **Owner / Next follow up** card (the two interactive controls left from "Details")
5. **Source / Added** card (lead source text + source contact picker + created date) — **moved to the bottom**

## 4. Sidebar sections become distinct cards

Wrap each left-rail section in the existing `.crm-card` utility (rounded-xl, padded, subtle border + shadow) instead of running them together as plain stacked sections. Property card already uses `crm-card-muted`; convert it to plain `crm-card` for visual consistency, and bump the gap between cards to 16px (`space-y-4`).

Result: each card visibly stands alone like a stack of small cards down the rail.

## 5. Remove the edit pencil — text fields are click-to-edit

In the local `InlineText` component:
- Remove the `Pencil` icon button (and its lucide import).
- The displayed value (or italic placeholder) becomes the click target itself. Click anywhere on the value to enter edit mode; Enter or blur saves (already implemented); Escape cancels (already implemented).
- Hover affordance: subtle muted background on hover so users discover the click target.

This applies automatically to every field already using `InlineText` (lead name, email, phone, company, source, property address). `NumField`, `Select`, and the contact picker already auto-save with no pencil — no change needed.

## Files touched

- `src/components/crm/LeadPeekSheet.tsx` — header title, sidebar reorder + cards, temperature removed, `InlineText` simplified
- (Optional, no CSS change needed — reuses existing `.crm-card` utility)

## Out of scope

- Deal peek sidebar — same treatment can be applied later if you want consistency, but you only asked about Leads.
- Schema/data — `temperature` column stays; no migration.
