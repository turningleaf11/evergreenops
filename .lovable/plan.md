

# UI Refresh: Row Context, Peek Views, and App-Wide Polish

## Issues to Address

1. **Goal/Project context on rows** — Remove emoji labels (`🎯`, `📁`). Show related goal/project as a subtle inline breadcrumb-style text with a separator dot, no emojis.

2. **Peek views feel bare** — Side peek, center peek, and full page detail views need visual structure: property grid with icons, section dividers, better spacing, and a header area with status pill and title.

3. **App-wide UI refresh** — Inspired by the uploaded screenshots (warm tones, generous whitespace, card-heavy layouts, soft shadows, professional typography).

---

## 1. Row Context (TableView + DataTableView)

**Current**: `🎯 Goal Title · 📁 Project Title` as a subtitle line.

**New**: Show as a small muted breadcrumb without emojis:
```
Goal Title > Project Title
```
Use `text-[11px] text-muted-foreground` with a `›` separator. If only one exists, show it alone without separator.

**Files**: `src/components/execution/TableView.tsx`, `src/components/execution/DataTableView.tsx`

---

## 2. Peek View Polish (DetailDrawer)

Redesign `DetailContent` to feel like a proper record page:

- **Header zone**: Large title, status pill inline, priority badge — all in a distinct top block with bottom border
- **Property grid**: Two-column layout for metadata (Status, Priority, Assignee, Due Date, Tags) using subtle icon + label pairs with consistent alignment
- **Mode switcher**: Move to top-right as icon-only buttons (no dropdown), highlight active mode
- **Description section**: Card-wrapped block with "Description" label
- **Subtasks**: Checkbox list inside its own section card
- **Comments**: Full-width section at bottom with clean separator
- **Center peek**: Add `rounded-2xl` and more padding to the dialog
- **Side peek**: Increase width to `sm:max-w-xl`, add padding

**File**: `src/components/DetailDrawer.tsx`

---

## 3. App-Wide UI Polish

### Layout & Header (`Layout.tsx`)
- Add subtle background tint to the header (warm beige in light mode, slightly lighter dark in dark mode)
- Increase header height to `h-14` with more breathing room
- Add a greeting or page title area on the left side of header

### Sidebar (`AppSidebar.tsx`)
- Increase icon + text spacing for nav items
- Add subtle rounded highlight for active state with accent color tint
- Workspace logo area: slightly larger, with subtle shadow

### Index / Home Page (`Index.tsx`)
- Add a warm greeting header ("Welcome, {name}") similar to the uploaded screenshots
- Cards with subtle shadow and rounded-2xl corners

### Global CSS (`index.css`)
- Adjust light mode `--background` to a slightly warmer tone (warm off-white like the screenshots)
- Increase `--radius` from `0.75rem` to `0.875rem` for softer corners globally
- Add a utility class for card shadows: `shadow-card` with a very soft, warm shadow

### Cards (`ui/card.tsx`)
- Default cards get `rounded-2xl` and a soft `shadow-sm` in light mode

---

## Files Summary

| Action | File |
|--------|------|
| Edit | `src/components/execution/TableView.tsx` — Remove emojis, breadcrumb context |
| Edit | `src/components/execution/DataTableView.tsx` — Same context fix |
| Edit | `src/components/DetailDrawer.tsx` — Redesign peek views |
| Edit | `src/components/Layout.tsx` — Header polish |
| Edit | `src/components/AppSidebar.tsx` — Nav styling |
| Edit | `src/pages/Index.tsx` — Welcome header, card polish |
| Edit | `src/index.css` — Warmer tones, shadow utility |
| Edit | `src/components/ui/card.tsx` — Rounded + shadow defaults |

No database changes needed.

