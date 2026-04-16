
Looking at the screenshots, the database views (Disposition Board) have three modes — Board (image-88), Table (image-89), and List (image-90) — but they don't match the polished Tasks/Projects styling.

Issues I can see:
1. **Board view**: Columns wrap to a second row (Closed, Fell Through drop below) instead of using the unified flex-fit + edge-fade overflow we just built for KanbanBoard. Column headers are bare text with a count, not the rounded card style.
2. **Table view**: Plain rows with no row chrome, no status dot, no hover affordance. Doesn't match `DataTableView`/`TableView`.
3. **List view**: Just a flat row of values — no status circle prefix, no card-enhanced row, no hover actions, no priority/assignee styling.
4. Header chrome (Back / Delete / title block) is fine but the chips below "tag" are stale field-name pills that duplicate the column headers — Tasks/Projects don't show this.

## Plan

**1. Unify Board view** (`DatabaseView.tsx` board mode)
- Replace its own kanban renderer with the same layout pattern from `execution/KanbanBoard.tsx`: flex `1 1 0`, min/max width, hidden scrollbar, edge fades, hover chevrons, shift+wheel scroll.
- Column header: status dot + label + count badge in a rounded header strip (match KanbanBoard).
- Cards: same rounded card chrome as task cards (border, hover lift, title, 2-3 key field rows).

**2. Unify List view** (`DatabaseView.tsx` list mode)
- Adopt the **Card-Enhanced List** pattern from `execution/TableView.tsx`: 56–64px row, hollow/solid status dot on the left, title prominent, secondary fields as right-aligned pills/badges (status pill, assignee, date), hover bg `bg-muted/50`, click-to-open drawer.
- No hover chevron buttons (already removed from TableView).

**3. Polish Table view** (already mostly aligned via earlier work)
- Verify it uses the same `DataTableView` grid styling, inline cells, resize handles, sticky header. Add status dot prefix in the title cell to match.
- Add subtle row hover bg, 40px row height parity.

**4. Header cleanup**
- Remove the stale field-name pill row under the description (Property / Buyer / Assignment Fee / Status / Close Date / Dispo Manager / tag) — these duplicate the table headers and aren't shown on Tasks/Projects pages.
- Keep title, description, Back, Delete.

**5. Toolbar parity**
- Search + Filter/Sort/Group + view toggle + New Row already match the style — verify spacing/sizing matches Execution toolbar exactly (same pill buttons, same gap, same icon sizes).

## Files
- `src/components/DatabaseView.tsx` — board, list, table mode rewrites; reuse KanbanBoard overflow pattern; reuse TableView row chrome
- `src/pages/DatabasesPage.tsx` — remove field-name chip row under description

No DB migrations.
