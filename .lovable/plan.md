# CRM Visual Polish Pass

A purely visual/spacing refinement of the existing CRM module. **No data, no schema, no behavior changes** — every click, query, save, and route stays identical. Only Tailwind classes, layout structure, and a few new design-token utilities change.

## Design tokens (added to `src/index.css` + `tailwind.config.ts`)

Centralize the brand palette referenced in the spec so we never sprinkle raw hex into components.

```css
/* index.css — :root and .dark */
--brand-azure: 230 64% 54%;     /* #3E54D3 */
--brand-mint:  165 67% 52%;     /* #2FDAAA */
--brand-tangerine: 19 100% 71%; /* #FFA16F */
--brand-coral: 350 83% 58%;     /* #ED3B5B */
--brand-violet: 258 56% 60%;
--brand-purple-muted: 245 16% 65%; /* #9896B8 */

/* Section eyebrow heading utility */
.crm-eyebrow { @apply text-[11px] font-semibold uppercase text-muted-foreground; letter-spacing: 0.12em; }
.crm-field-label { @apply text-xs text-muted-foreground mb-1; }
.crm-card { @apply rounded-xl bg-card p-6; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
.crm-card-muted { @apply rounded-xl bg-muted/30 p-6; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
.crm-section-stack > * + * { margin-top: 32px; }
.crm-field-stack > * + * { margin-top: 16px; }
```

Tailwind config: extend `colors.brand = { azure, mint, tangerine, coral, violet, purpleMuted }` so we can write `bg-brand-mint`, `text-brand-azure`, `border-brand-azure`, etc.

## Global rules applied everywhere in CRM

- All cards/panels: `rounded-xl` (12px), `p-6` (24px), elevation-1 shadow (no flat 1px borders).
- Section headings → `.crm-eyebrow`.
- Body text base → `text-sm` (14px); field labels → `.crm-field-label`.
- Empty/placeholder text → `italic text-muted-foreground`.
- Major sections separated by `space-y-8` (32px); fields within a section by `space-y-4` (16px).

## 1. Lead Detail View — `LeadPeekSheet.tsx` (+ `DocChecklist.tsx`, `BuyBoxButtons.tsx`)

- Remove the hard `border-r` between left rail and main content; replace with a single shared background and a subtle inset divider so it reads as one record.
- Wrap **Property** fields (address/city/state/zip/type/units/beds/baths/sqft) in a `.crm-card-muted` group with the eyebrow "PROPERTY".
- **DocChecklist.tsx**: replace `<Checkbox>` rows with three pill toggle buttons (`rounded-full px-4 py-2`, full-width on mobile, inline on desktop). Inactive: `bg-muted text-muted-foreground`. Active: `bg-brand-mint text-white` + leading `<Check />` icon.
- **BuyBoxButtons.tsx**: enlarge to `h-[52px] w-full rounded-xl text-sm font-medium`. Active states:
  - Fits → `bg-brand-mint text-white`
  - Maybe → `bg-brand-tangerine text-white`
  - Pass → `bg-brand-coral text-white`
  - Inactive → `bg-muted/50 text-foreground hover:bg-muted`
- Footer **"Convert to Deal →"** button → `bg-brand-azure hover:bg-brand-azure/90 text-white h-11 px-6 rounded-xl`, anchored bottom-right.

## 2. Contact Detail View — `ContactPeekSheet.tsx` (+ `contactTypes.ts`)

- Update `CONTACT_TYPE_COLOR` HSL values to match brand palette (azure / mint / muted-purple / tangerine / gray); badges already consume this map.
- Right "Contact Info" sidebar: drop the box border; use the same page background + a single `border-l border-border/50` divider so it reads integrated.
- Sidebar field groups → wrapped in `space-y-6` (24px between groups), each with `.crm-field-label` above the value.
- **Markets**: render each tag as a chip → `inline-flex items-center px-2.5 py-1 rounded-full bg-brand-azure/10 text-brand-azure text-xs font-medium`.

## 3. Deal Detail View — `DealPeekSheet.tsx` (+ `DealOverviewPanel.tsx`, `DealUnderwritingTab.tsx`)

- **TabsList**: increase to `h-11`, tabs `text-[15px] font-medium`, active tab gets a `border-b-2 border-brand-azure` underline (replace current pill-style active state).
- **Stage badge** in header → color map by stage:
  ```
  buy_box_check    → bg-muted text-muted-foreground
  quick_underwrite → bg-brand-azure/15 text-brand-azure
  broker_feedback  → bg-brand-tangerine/20 text-brand-tangerine
  deep_underwrite  → bg-brand-azure/15 text-brand-azure
  loi_sent         → bg-brand-violet/15 text-brand-violet
  due_diligence    → bg-brand-tangerine/20 text-brand-tangerine
  under_contract   → bg-brand-mint/20 text-brand-mint
  closed           → bg-emerald-700/15 text-emerald-700
  dead             → bg-brand-coral/15 text-brand-coral
  ```
- **Pricing block** (Overview): Asking price + Seller-stated value rendered at `text-lg font-semibold` (18px) with `.crm-field-label` above each.
- **Spread** in Underwriting tab: large `text-2xl font-semibold tabular-nums`, color `text-brand-mint` if positive (good for buyer), `text-brand-coral` if negative.
- Right sidebar (Stage / Owner / Team / Contacts): `.crm-section-stack` for 32px between sections, eyebrow headings, more breathing room.

## 4. Transaction Detail View — `TransactionDetailSheet.tsx`

- **KEY DATES**: switch from inline rows to a 4-card grid (`grid-cols-2 lg:grid-cols-4 gap-4`). Each card = `.crm-card` with eyebrow label, large date value, and (for Closing) a countdown chip:
  - `> 14 days` → `bg-brand-mint/15 text-brand-mint`
  - `7–14 days` → `bg-brand-tangerine/20 text-brand-tangerine`
  - `< 7 days`  → `bg-brand-coral/15 text-brand-coral`
  - Closing card spans 2 cols on desktop (`lg:col-span-2`), `p-7`, slightly larger date typography.
- **KEY PEOPLE**: 4 cards (Buyer / Title Agent / Attorney / Lender) in a `grid-cols-2 lg:grid-cols-4 gap-4`. Each card = icon (User/FileText/Scale/Banknote) + eyebrow label + embedded `<ContactPicker>`.
- **CLOSING CHECKLIST**:
  - Progress bar at top → `bg-brand-mint` fill on `bg-muted` track, `h-2 rounded-full`, with completed/total count.
  - Each row: circular toggle (`h-5 w-5 rounded-full border-2`), filled `bg-brand-mint border-brand-mint` with white check when complete.
  - Completed label → `line-through text-muted-foreground`.
  - Date pickers collapsed by default; row click expands to reveal the picker (use existing local `expandedId` state pattern; no data change).
- **"Mark as Closed"** button → `bg-brand-azure hover:bg-brand-azure/90 text-white rounded-xl h-10 px-5`.

## Files touched

- `src/index.css` — brand HSL tokens + crm utility classes
- `tailwind.config.ts` — register `brand.*` color aliases
- `src/components/crm/contactTypes.ts` — point HSL values to brand tokens
- `src/components/crm/LeadPeekSheet.tsx`
- `src/components/crm/DocChecklist.tsx`
- `src/components/crm/BuyBoxButtons.tsx`
- `src/components/crm/ContactPeekSheet.tsx`
- `src/components/crm/DealPeekSheet.tsx`
- `src/components/crm/DealOverviewPanel.tsx`
- `src/components/crm/DealUnderwritingTab.tsx`
- `src/components/crm/transactions/TransactionDetailSheet.tsx`

## Out of scope (unchanged)

- Database, RLS, queries, mutations, routes, dialog flows, kanban DnD, conversions, activity logging, file uploads.
- List/table views (`LeadsList`, `ContactsTable`, `DealsKanban`, `TransactionsList`) — only badge color updates flow into them automatically via `contactTypes.ts` and the new stage color map; no layout changes there unless you want them too (let me know).
