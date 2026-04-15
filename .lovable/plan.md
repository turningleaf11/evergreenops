

# App Style Switcher + Glassmorphism Theme

## Summary

Add an **App Style** setting (stored in workspace context + DB) that lets users switch between visual styles. Launch with two: **Standard** (current look) and **Crystal** (glassmorphism). The Crystal style applies translucent backgrounds, backdrop blurs, and a subtle gradient mesh behind content to give the glass something to show through.

---

## 1. Style System

**Type**: `"standard" | "crystal"` — stored as `appStyle` in WorkspaceContext, persisted to the `workspaces` table via a new `app_style` column.

When `crystal` is active, a CSS class `.style-crystal` is added to `<html>`. All glass overrides are scoped under `.style-crystal` in CSS — no component changes needed for the base styling.

---

## 2. CSS: Crystal Overrides (`src/index.css`)

Under `.style-crystal`:
- **Cards**: `background: hsl(var(--card) / 0.6)`, `backdrop-filter: blur(16px)`, `border: 1px solid hsl(var(--border) / 0.3)`
- **Sidebar**: `background: hsl(var(--sidebar-background) / 0.65)`, `backdrop-filter: blur(20px)`
- **Header**: `background: hsl(var(--card) / 0.5)`, `backdrop-filter: blur(16px)`
- **Popovers/Dialogs**: Semi-transparent with blur
- **Dark mode variants** under `.dark.style-crystal` with lower opacities (e.g. `bg-white/5`)

**Background mesh**: A subtle radial gradient overlay on `body` using `::before` pseudo-element — soft color blobs (using the accent hue) so the glass has depth. Only active in `.style-crystal`.

---

## 3. WorkspaceContext Changes

- Add `appStyle: string` to `WorkspaceState` (default: `"standard"`)
- Add `setAppStyle` setter
- On change, toggle `.style-crystal` class on `document.documentElement`
- Persist to DB via existing save mechanism

---

## 4. Database Migration

Add column to `workspaces` table:
```sql
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS app_style text DEFAULT 'standard';
```

---

## 5. Settings UI

Add a new card in the Workspace tab (between Theme and Accent Color):

**"App Style"** — Two visual option cards side by side:
- **Standard**: Small preview swatch showing solid cards on a flat background. Label: "Standard"
- **Crystal**: Small preview swatch showing translucent cards with blur effect. Label: "Crystal"

Selected style gets a primary border + check icon (same pattern as accent color picker).

---

## Files

| Action | File |
|--------|------|
| Edit | `src/index.css` — Add `.style-crystal` overrides + background mesh |
| Edit | `src/contexts/WorkspaceContext.tsx` — Add `appStyle` state, class toggle, DB persist |
| Edit | `src/pages/SettingsPage.tsx` — Add App Style picker card |
| Migration | Add `app_style` column to `workspaces` |

