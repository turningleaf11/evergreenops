

# CEO Cockpit Premium UI Refinement

## Overview
Refine the CEO Cockpit and establish a consistent design system across the app: premium layering, calm surfaces, polished tabs, and subtle interaction feedback.

---

## 1. Brain Dump — Primary Command Surface

**File**: `src/pages/CeoDashboard.tsx`
- Wrap Brain Dump in an elevated container: `bg-primary/[0.03]` tinted background, `shadow-md` soft shadow, `p-8` generous padding, `rounded-2xl`
- The inner `RichTextEditor` stays clean (neutral `bg-card` or white)
- Remove the current `rounded-xl border border-border bg-card p-5` wrapper — replace with the elevated style
- Brain Dump visually dominates; other cards stay at lower elevation

## 2. Current Objective — Slim, Above Brain Dump

**File**: `src/pages/CeoDashboard.tsx`
- Reduce from `text-xl font-semibold` to `text-base font-medium`
- Keep muted label (`text-xs uppercase tracking-widest`)
- Remove heavy `border-b` divider, use `mb-6` spacing instead
- Should feel like a pinned context line, not a section

## 3. Premium Tab Styling

**File**: `src/pages/CeoDashboard.tsx` (TabsList/TabsTrigger overrides via className)
- Active tab: `bg-primary/10 text-primary font-semibold` with `transition-all duration-200`
- Inactive tab: `text-muted-foreground hover:text-foreground` with no background
- TabsList: transparent background, no pill container — just the tab buttons
- Add `transition-colors duration-200` to all triggers

## 4. Global Layering System

**File**: `src/index.css`
- Define utility classes for consistent elevation:
  - `.elevation-0` — page background (neutral base, no shadow)
  - `.elevation-1` — standard cards: `shadow-sm` + subtle border
  - `.elevation-2` — Brain Dump / featured surfaces: `shadow-md`, slightly tinted bg
  - `.elevation-3` — floating buttons/popovers: `shadow-lg`
- All shadows use the existing soft multi-layer style, just at different intensities

## 5. Interaction Feedback

**File**: `src/index.css` + component overrides
- Buttons: add `active:scale-[0.97]` (already on primary, extend to all)
- Inputs: `focus:ring-2 focus:ring-primary/20` subtle glow (no harsh ring)
- Cards: hover shadow increase already exists via `[data-slot="card"]`, keep consistent
- Tabs: `transition-all duration-200` for color/background changes

## 6. Remove Heavy Gray Backgrounds

**File**: `src/pages/CeoDashboard.tsx`
- Replace `bg-card` on Command tab cards with lighter treatment
- Use `bg-card/80` or `bg-background` for less visual weight
- Section headers: remove `uppercase tracking-widest` heavy style, use `text-xs font-medium text-muted-foreground`

## 7. Icon Consistency

**File**: `src/pages/CeoDashboard.tsx`
- Ensure all Lucide icons use consistent `h-4 w-4` sizing
- Apply `text-muted-foreground/70` (not pure black) to non-primary icons
- Sidebar icons already use Lucide — verify consistent stroke width across the page

## 8. Spacing & Radius Standardization

**Files**: `src/pages/CeoDashboard.tsx`, `src/index.css`
- Cards: `rounded-2xl` consistently (already in aesthetic memory)
- Inputs/buttons: `rounded-xl` (12px, already set)
- Internal spacing: 8px scale (`p-4`, `p-6`, `p-8`, `gap-4`, `gap-6`)
- Page padding: `px-8 pt-10 pb-16`

---

## Technical Summary

| File | Changes |
|------|---------|
| `src/pages/CeoDashboard.tsx` | Brain Dump elevation, slim objective, tab styling, icon consistency, spacing |
| `src/index.css` | Elevation utility classes, interaction feedback utilities |
| `src/components/ScratchPad.tsx` | Padding/spacing adjustments for breathing room |
| `src/components/ui/tabs.tsx` | Update default tab styles for smoother transitions |

No database changes. No new dependencies. Pure CSS/className refinement.

