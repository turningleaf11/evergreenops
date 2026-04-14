

# Card-Enhanced List + Data Table + Hover Actions

## Summary

Three changes: (1) upgrade the **List view** with card-styled rows, status blocks, and hover action buttons; (2) create a separate **Table view** as a proper data-grid with column headers and sortable columns; (3) both views currently render the same `TableView` component — fix that.

## 1. Upgrade List View (`TableView.tsx` → card-enhanced)

Current `TableView` becomes the **List view** only (used when `view === "list"`).

**Row styling:**
- Height 56–64px, `rounded-xl` (12px), tinted background (`bg-muted/30`), padding `px-4 py-3`
- On hover: `hover:shadow-md hover:-translate-y-[1px]` for lift effect
- Maintain status dot on left, title, priority pill, due date, avatar on right

**Status group blocks:**
- Each group wrapped in a container with `rounded-xl bg-muted/20 p-3 space-y-1.5` so it feels like its own visual block
- Group header with dot + label + count stays as-is, rows indented inside the block

**Hover action buttons:**
- On row hover, show 2–3 icon buttons on the far right (Edit/Pencil, Archive, MoreHorizontal)
- Hidden by default, visible via `opacity-0 group-hover/row:opacity-100` transition
- Each button is an icon-only ghost button, clicks stop propagation

**Quick-complete checkbox (tasks only):**
- For task type, show a small checkbox on the far left (before the status dot)
- Checking it sets status to "done"

## 2. New Data Table View (`DataTableView.tsx`)

Create `src/components/execution/DataTableView.tsx` — a proper columnar grid.

**Structure:**
- Uses `<Table>` components from `ui/table.tsx`
- Column headers: Name, Status, Priority, Assignee, Due Date — clickable for sorting
- Compact rows (~40px height), no card styling, dense data view
- Status and priority shown as small inline pills
- Clicking a row opens the detail drawer (same `onItemClick`)
- Status cell is a clickable Select (inline edit)

**Props:** Same interface as `TableView` so it's a drop-in swap.

## 3. Wire up in ExecutionPage

- `view === "list"` → renders `TableView` (card-enhanced list)
- `view === "table"` → renders new `DataTableView`
- Currently both render `TableView` — fix the table case to use `DataTableView`

## Files

| Action | File |
|--------|------|
| Edit | `src/components/execution/TableView.tsx` — Card styling, hover actions, status blocks, checkbox |
| Create | `src/components/execution/DataTableView.tsx` — Columnar data table |
| Edit | `src/pages/ExecutionPage.tsx` — Import `DataTableView`, use it for `view === "table"` |

No database changes needed.

