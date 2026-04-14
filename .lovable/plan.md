

# Fix Accent Color + Redesign TableView Rows

## 1. Fix Custom Accent Color (store full HSL, not just hue)

**Problem**: `applyAccentHue` only uses the hue value and reconstructs with hardcoded S=65% L=48%. So `#29896e` (hue 160, sat 54%, light 35%) gets displayed as a different, brighter green.

**Fix**:
- Change `accentColor` storage from hue-only string (e.g. `"160"`) to full HSL string (e.g. `"160 54% 35%"`) when a custom hex is entered
- Update `applyAccentHue` → `applyAccentColor` to accept either a bare hue (for presets, backward compat) or a full `"H S% L%"` string
- Update `hexToHue` → `hexToHsl` to return full H/S/L values
- Keep presets working as before (they already have fixed S/L)

**Files**: `src/contexts/WorkspaceContext.tsx`, `src/pages/SettingsPage.tsx`

## 2. Redesign TableView Rows

**Changes**:
- Remove the colored `border-l-[3px]` from each row
- Add a small clickable **status dot** (colored circle, ~10px) on the left of each row; clicking it opens the status `<Select>` dropdown
- Remove the separate status pill from the right side (the dot replaces it)
- **Indent rows** under their group header — group header stays at `px-1`, rows get `ml-6` so they visually nest under the status group label
- Keep everything else (priority pill, avatar, due date) on the right

**Files**: `src/components/execution/TableView.tsx`

## Files Summary

| Action | File |
|--------|------|
| Edit | `src/contexts/WorkspaceContext.tsx` — Update `applyAccentHue` to handle full HSL |
| Edit | `src/pages/SettingsPage.tsx` — `hexToHsl` instead of `hexToHue`, store full HSL |
| Edit | `src/components/execution/TableView.tsx` — Status dot + indented rows |

No database changes needed.

