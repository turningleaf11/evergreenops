

# Accent Color Customizer

## Approach
Add a color picker to Settings that lets the admin choose one accent color. The app derives all primary/ring/sidebar-primary colors from it by setting CSS custom properties at runtime. The chosen color persists in the `workspaces` table.

## Database
- **Migration**: Add `accent_color` column (text, nullable) to `workspaces` table — stores the HSL hue value (e.g., `"220"` for blue, `"142"` for green, `"280"` for purple)

## How it works
1. **WorkspaceContext** loads `accent_color` from the workspace row and exposes `setAccentColor(hue)`
2. On mount (and on change), a `useEffect` sets CSS variables on `document.documentElement`:
   - `--primary` → `{hue} 65% 48%` (light) / `{hue} 65% 55%` (dark)
   - `--ring` → same as primary
   - `--sidebar-primary` → same as primary
   - `--sidebar-ring` → same as primary
   - `--sidebar-accent` → `{hue} 14% 92%` (light) / `{hue} 14% 12%` (dark)
   - Secondary/muted/accent backgrounds shift hue subtly too
3. Defaults to hue `220` (current blue) if no custom color set

## Settings UI
Add an "Appearance" section in SettingsPage with a row of ~8 color circles (preset hues: blue 220, green 142, purple 280, orange 25, red 0, teal 175, pink 330, indigo 245). Clicking one applies it instantly and saves to the workspace. Active one gets a check mark.

## Files changed

| File | Change |
|------|--------|
| Migration | Add `accent_color` to `workspaces` |
| `src/contexts/WorkspaceContext.tsx` | Load/save accent color, apply CSS vars |
| `src/pages/SettingsPage.tsx` | Add Appearance section with color preset circles |

