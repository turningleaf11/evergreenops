

# Sidebar polish + drawer cleanup + inline-editable tables + Lists redesign

## A. Sidebar fixes

### A.1 "Hidden" area is the duplicate workspace header
The `SidebarHeader` block (lines 109–125 of `AppSidebar.tsx`) re-renders the logo + workspace name — but the same info is already in the global header. Because the sidebar now sits underneath the header, the sidebar's own header just shows blank/wasted space.

**Fix** in `AppSidebar.tsx`: remove the `SidebarHeader` block entirely. Sidebar starts straight at nav items. Reclaims ~60px of vertical space.

### A.2 Move sidebar trigger to the bottom
- **`Layout.tsx`**: remove `<SidebarTrigger />` from the global header (keep workspace logo+name where it is).
- **`AppSidebar.tsx`** `SidebarFooter`: add a `SidebarTrigger` button at the very bottom (icon: `PanelLeft`). Renders compact in collapsed mode (just the icon), wider with "Collapse" label when expanded.

## B. Drawer: remove chevrons on Status/Priority/Assignee rows

**`src/components/shared/AccordionField.tsx` (FieldRow)**: remove the `<ChevronDown />` icon from the value-cell trigger button (lines 59–64). Field still opens a popover on click — just no visible chevron. Hover background stays as the affordance.

## C. Inline-editable Execution table view

### C.1 New shared component
**`src/components/shared/InlineCell.tsx`** — small wrapper that renders by type:
- `text` → click → `<Input>` autofocus, blur autosaves
- `select` → click → `Popover` with options
- `assignee` → click → `Popover` listing profiles, search-filterable
- `date` → click → `Popover` with `Calendar`
- `priority` → click → `Popover` with priority badges

All emit a single `onChange(value)` callback. Display state shows the current value styled identically to today (badge for priority, avatar for assignee, etc.).

### C.2 Wire into `DataTableView.tsx`
Replace the existing read-only cells with `<InlineCell>` for: `title`, `status`, `priority`, `assigned_to`/`owner_id`, `due_date`. Keep current row click → opens drawer (only when clicking outside an InlineCell — InlineCells `stopPropagation`).

Add an `onUpdate(id, patch)` prop. Wire it from `ExecutionPage.tsx` → updates Supabase `tasks` / `projects` row.

### C.3 Auto-fit + resize (already partially in place)
Keep current `useColumnWidths` resize logic. Ensure `gridTemplateColumns` uses `minmax(<min>, <stored | 1fr>)` so columns auto-expand to fill available width when no user-set width exists.

## D. Lists/Databases — match Tasks/Projects look & feel

### D.1 `DatabaseView.tsx`
Replace its current table renderer with the same `<SpreadsheetTable>`-style markup pattern from `DataTableView.tsx`:
- Same row height (~40px), same hover bg, same sort headers, same resize handles via `useColumnWidths` (key `database-{id}`)
- Same `<InlineCell>` usage based on `databases_meta.columns[].type` mapping (`text`, `select`, `multi_select`, `date`, `number`, `relation`, `user`)
- Same "click row → opens record drawer" behaviour
- For card/list mode (if DatabaseView has one), reuse the same row chrome from execution `TableView.tsx` (status circle, title, badges, hover actions)

Also unifies `DatabaseRecordDetail.tsx` drawer with `DetailDrawer.tsx` chrome — already aligned via `FieldRow`, so just removing chevrons (C.B) carries over for free.

## Files Summary

| Action | File |
|--------|------|
| Edit | `src/components/AppSidebar.tsx` — remove SidebarHeader, add SidebarTrigger to footer |
| Edit | `src/components/Layout.tsx` — remove SidebarTrigger from header |
| Edit | `src/components/shared/AccordionField.tsx` — remove chevron icon |
| New  | `src/components/shared/InlineCell.tsx` — type-aware inline editor |
| Edit | `src/components/execution/DataTableView.tsx` — use InlineCell, accept onUpdate |
| Edit | `src/pages/ExecutionPage.tsx` — wire onUpdate → Supabase patch |
| Edit | `src/components/DatabaseView.tsx` — adopt DataTableView styling + InlineCell |

No DB migrations.

