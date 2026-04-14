

# My Notes + Folders + Apple/Arc Aesthetic Refresh

## 1. Notes changes

### Rename to "My Notes"
- Update sidebar label in `AppSidebar.tsx` from "Notes" to "My Notes"
- Update page header in `NotesPage.tsx`

### Add folder management
- **Migration**: Add `folder` column (text, nullable, default null) to the `notes` table
- Add a folder sidebar section above the notes list: shows folder names with note counts
- "All Notes" at top, then named folders below, then an "+ New Folder" text button
- Clicking a folder filters the list; right-click or hover reveals rename/delete
- Notes can be moved to a folder via a small folder picker in the note header bar
- Notes without a folder show under "All Notes" (or "Unfiled")

### Clean up note sidebar UI
- Remove the content preview snippet line — show only title and date
- Tighter vertical spacing, single line per note entry

## 2. Apple/Arc aesthetic pass

The user wants: soft gradients, gentle shadows, rounded corners, translucent panels, elegant and polished. Here's the concrete translation across the app:

### Global CSS (`index.css`)
- Increase `--radius` from `0.5rem` to `0.75rem` (rounder corners everywhere)
- Soften `--border` to be lighter/more subtle
- Add a subtle backdrop-blur class for panels (`.glass-panel`)
- Soften card shadows: replace hard borders with gentle `shadow-sm` + very light border

### Component-level changes
- **Cards** (`card.tsx`): Default to `shadow-sm border-border/50 rounded-xl` instead of hard border
- **Inputs** (`input.tsx`): Softer border, slightly taller (h-10), rounder (`rounded-lg`), subtle background tint on focus instead of ring
- **Buttons** (`button.tsx`): Rounder corners (`rounded-lg`), softer primary color, subtle hover transitions
- **Select triggers**: Rounder, softer borders, no chevron icon or make it very subtle
- **Dialogs** (`dialog.tsx`): Add `rounded-2xl shadow-2xl` with subtle backdrop blur on overlay
- **Sidebar** (`sidebar.tsx` + CSS vars): Subtle translucency with `backdrop-blur-xl bg-sidebar/80`
- **Badges**: Softer pill shape (`rounded-full`), lighter backgrounds
- **Tabs**: Softer active indicator, rounder pill-style tab triggers

### Execution page goal creation dialog
- Apply the same de-formed treatment as the global create menu: placeholder inputs, inline badge pickers for status, collapsible optional fields

### Typography
- Already using Inter which works well for this aesthetic — no change needed

## Files changed

| File | Change |
|------|--------|
| Migration | Add `folder` column to `notes` table |
| `src/index.css` | Increase radius, soften borders, add glass-panel utility |
| `src/components/ui/card.tsx` | Softer shadow + rounder corners |
| `src/components/ui/input.tsx` | Rounder, softer focus style |
| `src/components/ui/button.tsx` | Rounder corners, smoother transitions |
| `src/components/ui/dialog.tsx` | Rounder, shadow-2xl, blur overlay |
| `src/components/ui/badge.tsx` | Rounded-full pills |
| `src/components/ui/tabs.tsx` | Softer tab style |
| `src/components/ui/select.tsx` | Rounder, subtler chrome |
| `src/components/AppSidebar.tsx` | Rename "Notes" → "My Notes", translucent sidebar |
| `src/pages/NotesPage.tsx` | Folder system, clean sidebar UI (remove previews), folder picker in header |
| `src/pages/ExecutionPage.tsx` | De-form goal creation dialog |

