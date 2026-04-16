

# Flexible Row-Based Home Layout + Unified Kanban with Editable Stage Colors

## Part 1: Row-Based Home Layout

Replace the single/double column toggle with a **row-based section model**. Each row holds 1 (full-width) or 2 (split) widgets. Widgets auto-resize based on row occupancy. Drag a widget into any row's slot — the layout adjusts automatically.

### Data model
Persist per user in `localStorage` (key: `home_layout_rows_v1`):
```ts
type Row = { id: string; slots: [string | null, string | null] }; // up to 2 widgets per row
type Layout = { rows: Row[] };
```
- A row with `[widgetId, null]` renders that widget full-width.
- A row with `[a, b]` renders both at 50/50.
- Empty rows act as drop zones. An "+ Add row" button at the bottom adds a new empty row.

### File: `src/hooks/useWidgetPreferences.ts`
- Add `rowLayout: Row[]` state alongside existing prefs, load/save from localStorage
- Helper functions: `moveWidget(widgetId, toRowId, toSlot)`, `addRow()`, `removeRow(rowId)`, `clearVisible()` rebuilds rows from visible widgets when no saved layout exists (default = each visible widget in its own full-width row)

### File: `src/pages/Index.tsx`
- Remove `layoutMode` toggle (Columns2 / Square buttons)
- Replace 2-column DnD grid with a vertical stack of `Row` components
- Each Row renders 1 or 2 droppable slots using `dnd-kit`. Each slot shows either a widget or an empty placeholder ("Drop a widget here")
- A widget dragged from one slot to another triggers `moveWidget`. If a widget leaves a row's second slot, the remaining widget auto-grows to full-width (because slot 2 = null).
- Each row has a small "+" button on its right edge that splits a full-width widget into a 2-slot row (places a placeholder in slot 2 that the user can drop into).
- "+ Add row" button at the bottom of the stack
- Hidden widgets are listed in the `WidgetCustomizer` and can be dragged back into any slot
- Horizontal feed at top and tinted announcements styling stay as-is

### Visual feel
- Rows have subtle dividers, no boxes around slots
- Empty slot placeholder: dashed border, muted "+ Drop widget" hint, only visible when in customize/edit mode (toggle in header)

---

## Part 2: Unified Kanban Across Tasks, Projects, Lists + Editable Stage Colors

### Goal
- Use the same `KanbanBoard` styling (Trello cards, stripes, "+ Add card", hover lift) for **all** board views: Tasks, Projects, and Lists/Databases.
- Replace colored dots in column headers with **soft-tinted full-width header bars** (label in the stage's deep color, no dot).
- Allow per-board color editing.

### File: `src/components/execution/KanbanBoard.tsx`
- Update `KanbanColumn` type to `{ key, label, color }` where `color` is now the **base color name** (e.g., `"slate" | "blue" | "red" | "green" | "amber" | "indigo" | "violet" | "rose" | "cyan" | "pink"`) instead of a tailwind bg class
- Header: replace dot + neutral header with `bg-{color}-500/15 text-{color}-700 dark:text-{color}-300` rounded pill spanning the column header, label uppercase, count badge stays on the right
- Column body background uses a slightly tinted version (`bg-{color}-500/5`) instead of generic `bg-muted/30`
- Add optional `onEditColumnColor?: (key: string, newColor: string) => void` prop. When present, render a small pencil/swatch button on hover of the header that opens a color picker popover (10-color palette).

### File: `src/components/DatabaseView.tsx` (`GenericKanban`)
- Replace the inline kanban with the shared `KanbanBoard` component. Map select/status options to `columns` with their stored `color`. Map rows to items.
- Wire `onEditColumnColor` to update the corresponding select option's color in `databases_meta.columns` (already supported — colors live in field options).
- Wire `onAddCard` to create a new row with that group value pre-filled.

### File: `src/pages/ExecutionPage.tsx`
- Convert `projectKanbanCols` and `taskKanbanCols` to use named colors (`slate`, `blue`, `red`, `green`)
- Load any custom colors from a new `kanban_stage_colors` table (per board scope) and merge before passing to `KanbanBoard`
- Wire `onEditColumnColor` to upsert into `kanban_stage_colors`

### Database
New table for Tasks/Projects board color overrides (per board, since user chose "Per board/list"):
```sql
CREATE TABLE public.kanban_stage_colors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid,
  board_type text NOT NULL,    -- 'task' | 'project'
  stage_key text NOT NULL,     -- 'todo', 'in_progress', etc.
  color text NOT NULL,         -- 'slate' | 'blue' | ...
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, board_type, stage_key)
);
```
RLS: authenticated can SELECT all in workspace; admins manage all; any authenticated can INSERT/UPDATE/DELETE for their workspace (matches existing project/task permissiveness).

For Lists/Databases, no migration needed — colors live in the existing `databases_meta.columns[].options[].color` field config.

---

## Files Summary

| Action | File |
|--------|------|
| Edit | `src/hooks/useWidgetPreferences.ts` — add `rowLayout` + helpers (localStorage) |
| Edit | `src/pages/Index.tsx` — replace col grid with row-based slot layout |
| Edit | `src/components/home/WidgetCustomizer.tsx` — minor: drag hidden widgets into slots |
| Edit | `src/components/execution/KanbanBoard.tsx` — tinted header bars, named-color system, color picker hook |
| Edit | `src/components/DatabaseView.tsx` — replace `GenericKanban` with shared `KanbanBoard` |
| Edit | `src/pages/ExecutionPage.tsx` — load/save stage color overrides, named colors |
| New | Migration: `kanban_stage_colors` table + RLS |

DB migration required for kanban color overrides on tasks/projects.

