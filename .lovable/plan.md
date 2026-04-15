
I inspected the current code and found why the sidebar still looks tinted.

## What’s actually happening
- The current source no longer applies an accent-colored sidebar background in `src/contexts/WorkspaceContext.tsx`.
- But the earlier implementation did set sidebar CSS variables inline on the root element. The current `applyAccentColor()` stopped setting those values, but it never clears them.
- So in the live preview, old inline values like `--sidebar-background` can keep sticking around, which is why your sidebar still looks green/mint even though the code was changed.
- There’s also a second issue: the default sidebar tokens in `src/index.css` are still slightly chromatic, not truly neutral, so even the fallback sidebar palette still reads a bit tinted.

## Plan

### 1. Clear the old sidebar tint properly
Update `src/contexts/WorkspaceContext.tsx` so `applyAccentColor()` explicitly removes stale sidebar surface variables before applying the current accent.
- Clear:
  - `--sidebar-background`
  - `--sidebar-foreground`
  - `--sidebar-accent`
  - `--sidebar-accent-foreground`
  - `--sidebar-border`
- Keep accent only on:
  - `--primary`
  - `--ring`
  - `--sidebar-primary`
  - `--sidebar-primary-foreground`
  - `--sidebar-ring`

This makes the fix show up immediately without relying on a hard refresh.

### 2. Make the sidebar actually neutral
Refine `src/index.css` so the sidebar shell uses true low-saturation neutrals.
- Neutralize:
  - `--sidebar-background`
  - `--sidebar-accent`
  - `--sidebar-border`
  - related text/surface tokens
- Keep accent usage limited to:
  - buttons
  - focus states
  - active indicators
  - highlights

### 3. Tone down sidebar item coloration
Adjust `src/components/AppSidebar.tsx` so the sidebar items feel premium and controlled instead of color-washed.
- Replace general `bg-muted/60` sidebar hover styling with sidebar-specific neutral hover
- Soften active state:
  - neutral pill background
  - accent left rail / icon / text only
  - no broad accent-tinted block

### 4. Fix one more reason the redesign felt subtle
There’s another implementation gap: `src/index.css` has card polish rules targeting `[data-slot="card"]`, but `src/components/ui/card.tsx` does not render that attribute.
- I’ll wire the Card component to that selector so the surface depth and hover polish actually apply across the app.

## Files to update
- `src/contexts/WorkspaceContext.tsx` — remove stale sidebar CSS vars
- `src/index.css` — neutralize sidebar tokens and calibrate sidebar states
- `src/components/AppSidebar.tsx` — reduce sidebar hover/active tinting
- `src/components/ui/card.tsx` — connect card depth CSS to the actual component

## Expected result
- The sidebar shell will stop inheriting the green accent tint
- The sidebar will stay neutral in light and dark mode
- Accent color will only show where it should
- The UI changes will feel more obvious and intentional instead of looking like “just a tinted sidebar”

## QA
I’ll verify on `/settings` with your current green accent that:
- the sidebar shell is neutral
- changing accent colors only affects actions/indicators
- light and dark mode both stay neutral
- cards show the intended premium depth once the card selector is connected

No backend or database changes are needed.
