

# Standardize Docs/Notes Layout, Custom Colors, Dark Mode, Department Icons

## 1. Standardize Docs & Notes Editor Padding

**Problem**: The borderless RichTextEditor CSS uses `padding: 0.5rem 0` (no horizontal padding). Docs wraps the editor in a `p-6` container so it looks fine, but Notes puts it in a bare `flex-1 overflow-auto` div — no side cushion at all.

**Fix**: Update `RichTextEditor.css` to give the borderless mode consistent horizontal padding (`padding: 0.5rem 1.5rem`). Also ensure the Docs `InlineDocEditor` wrapper and Notes editor area use matching horizontal padding so the title, metadata, tags, and content all align consistently. Target: `~1.5rem` (24px) side padding on both pages.

## 2. Custom Accent Color (HSL Hue Input)

**Current**: The `AccentColorPicker` in Settings only offers 8 preset color swatches. No way to enter a custom value.

**Fix**: Add an `Input` field below the preset swatches that lets the admin type a custom hue value (0-360). Show a live preview swatch next to the input. When the user types a value, it applies via `setAccentColor` just like the presets.

## 3. Dark / Light Mode Toggle

**Current**: The CSS already has a full `.dark` theme defined in `index.css`, and the `applyAccentHue` function in `WorkspaceContext` already checks `root.classList.contains("dark")`. But there's no UI to toggle it, and no theme persistence.

**Fix**:
- Add a `ThemeProvider` context that reads/writes theme preference to `localStorage` and applies the `dark` class to `<html>`.
- Add a theme toggle (Sun/Moon icon) in:
  - The sidebar footer (next to avatar/sign-out)
  - The Settings > Appearance card (as an explicit Light/Dark/System selector)
- When toggling, also re-run `applyAccentHue` so accent colors adjust for dark mode.

## 4. Custom Icons for Department Pages

**Current**: Departments have an `icon` column storing a string (e.g. "Building2"), but the icon map in `AppSidebar` and `Index.tsx` only has 5 options: `Code2, Palette, Lightbulb, Megaphone, Settings`. All new departments default to `Building2`.

**Fix**:
- Expand the icon map to ~20 icons covering common department types (e.g. `Briefcase`, `DollarSign`, `Heart`, `Shield`, `Truck`, `Wrench`, `BarChart3`, `Globe`, `Phone`, `GraduationCap`, `Scale`, `Home`, `Layers`, `Target`, `Zap`, `Users`).
- Add an icon picker to the department row in Settings. Show a grid of icon options in a popover — clicking one updates `dept.icon`.
- Share the icon map from a single `lib/icon-map.ts` file so `AppSidebar`, `Index.tsx`, `DepartmentPage.tsx`, and `SettingsPage.tsx` all use the same set.

## Files

| Action | File |
|--------|------|
| Edit | `src/components/RichTextEditor.css` — Add horizontal padding to borderless mode |
| Edit | `src/pages/NotesPage.tsx` — Standardize editor wrapper padding to match Docs |
| Edit | `src/pages/DocsPage.tsx` — Minor padding alignment if needed |
| Create | `src/contexts/ThemeContext.tsx` — Theme provider with localStorage persistence + dark class toggle |
| Edit | `src/main.tsx` — Wrap app in ThemeProvider |
| Edit | `src/components/AppSidebar.tsx` — Add dark/light toggle icon in footer |
| Edit | `src/pages/SettingsPage.tsx` — Add custom hue input to AccentColorPicker, add Light/Dark/System toggle in Appearance card, add icon picker to department rows |
| Edit | `src/contexts/WorkspaceContext.tsx` — Re-apply accent hue when theme changes |
| Create | `src/lib/icon-map.ts` — Shared department icon map (~20 icons) |
| Edit | `src/pages/Index.tsx` — Use shared icon map |
| Edit | `src/pages/DepartmentPage.tsx` — Use shared icon map |

No database changes needed — the `departments.icon` column already stores icon name strings.

