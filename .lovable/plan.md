

# 3-Phase Plan: Build Fix + UI Polish + Inline-Editable Tables

---

## Phase 1 — Build fix + global styling polish (this loop)

### 1.1 Fix build error
**`src/pages/ExecutionPage.tsx`** — wrap the base columns with `useMemo` that merges `stageColors` overrides:
```ts
const projectKanbanCols = useMemo(
  () => projectKanbanColsBase.map(c => ({ ...c, color: stageColors[`project:${c.key}`] || c.color })),
  [stageColors]
);
const taskKanbanCols = useMemo(
  () => taskKanbanColsBase.map(c => ({ ...c, color: stageColors[`task:${c.key}`] || c.color })),
  [stageColors]
);
```

### 1.2 Warm off-white app background
**`src/index.css`** — change `--background` from `220 20% 96%` (cool grey) to `38 30% 97%` (warm off-white). Adjust dark mode untouched. `--muted` slightly warmed to match.

### 1.3 Reply input — soft accent tint, not grey
**`src/components/feed/ReplyThread.tsx`** — wrapper already `bg-primary/[0.04]`; tint the `Textarea` itself with `bg-primary/[0.06] border-primary/15 focus-visible:ring-primary/30`. Confirms collapsed-by-default behavior is preserved (it already is — composer only renders when `repliesExpanded` is true in `PostCard`).

### 1.4 Drawer sits under header
**`src/components/DetailDrawer.tsx`** — on the `Sheet` `SheetContent` (side peek mode), add `top-[60px] h-[calc(100vh-60px)]` plus `border-l border-border/50`. Same fix wherever else `Sheet` is used as a record drawer (DatabaseRecordDetail, PersonDetail).

### 1.5 Wiki/Notes middle column tinted with accent
**`src/pages/DocsPage.tsx`** + **`src/pages/NotesPage.tsx`** — change the middle list panel from grey to `bg-primary/[0.04]`. Editor stays white. Selected/hover items use `bg-primary/10` / `bg-primary/15`.

### 1.6 Accent "+ New" buttons everywhere
Audit and update primary create buttons to `variant="default"` (filled accent) on:
- ExecutionPage (Task/Project/Goal/Issue create buttons)
- DatabasesPage (Add Row, Create Database)
- DatabaseView (+ row button)
- NotesPage (New Note)
- DocsPage (New Doc)
- PeoplePage (Add Person)

---

## Phase 2 — Field-first record drawer (next loop)

### 2.1 Refactor `DetailDrawer` field rows
Replace the always-visible Select dropdowns with **collapsible accordion rows**. Each property row shows just the label + current value as a clean text/badge. Click → row expands inline to show the picker. Click another field → previous collapses. State managed via `useState<string | null>(openField)`.

Visual:
```
Status        ▸ In Progress
Assignee      ▸ Sarah Chen
Tags          ▸ design, urgent
```

Click "Status" → expands to:
```
Status        ▾
  ○ Not Started
  ● In Progress
  ○ Done
  ○ Blocked
```

Apply same pattern to:
- `DetailDrawer.tsx` (tasks/projects)
- `DatabaseRecordDetail.tsx` (list rows)
- `PersonDetail.tsx` if applicable

No more visible Select boxes / Input fields by default. Title remains as the heading at top.

---

## Phase 3 — Inline-editable, unified table & list views (next loop)

### 3.1 Spreadsheet view (`DataTableView` for tasks/projects + `DatabaseView` table)
Unify into a shared `<SpreadsheetTable>` component:
- Soft vertical + horizontal grid lines (`border-border/30`)
- **Inline cell editing**:
  - Text/title → click cell → contentEditable input → blur autosaves
  - Status/select → click cell → dropdown opens → select autosaves
  - Date → click cell → date picker → autosaves
  - Multi-select tags → click → multi-select popover → autosaves
- **Column resize**: drag handle on right edge of header cell. Persist widths in `localStorage` keyed by `spreadsheet:{type}:{columnKey}`.
- **Hover row title** → reveal expand icon (Maximize2) → opens drawer

### 3.2 List view (`TableView` for tasks/projects + `DatabaseView` list)
Same inline-editing as spreadsheet, but:
- Only horizontal dividers between rows (no vertical grid)
- Card-row aesthetic preserved (status circle, avatar chips)
- Same hover-to-expand icon on row title

### 3.3 Unify across Execution + Lists
`DatabaseView`'s table/list rendering swapped to use the same shared components, with column definitions derived from `databases_meta.columns`.

---

## Files Summary

### Phase 1 (this loop)
| Action | File |
|--------|------|
| Edit | `src/pages/ExecutionPage.tsx` — useMemo merge for kanban cols |
| Edit | `src/index.css` — warm off-white `--background` |
| Edit | `src/components/feed/ReplyThread.tsx` — tinted Textarea |
| Edit | `src/components/DetailDrawer.tsx` — top offset + height |
| Edit | `src/components/DatabaseRecordDetail.tsx` — same offset |
| Edit | `src/components/PersonDetail.tsx` — same offset |
| Edit | `src/pages/DocsPage.tsx` — accent-tinted middle panel |
| Edit | `src/pages/NotesPage.tsx` — accent-tinted middle panel |
| Edit | Multiple pages — accent-color "+ New" buttons |

### Phase 2 (next)
| Action | File |
|--------|------|
| Edit | `src/components/DetailDrawer.tsx` — accordion field rows |
| Edit | `src/components/DatabaseRecordDetail.tsx` — same pattern |
| Edit | `src/components/PersonDetail.tsx` — same pattern |

### Phase 3 (next)
| Action | File |
|--------|------|
| New  | `src/components/shared/SpreadsheetTable.tsx` — unified inline-edit table |
| New  | `src/components/shared/ListRows.tsx` — unified inline-edit list |
| Edit | `src/components/execution/DataTableView.tsx` — use SpreadsheetTable |
| Edit | `src/components/execution/TableView.tsx` — use ListRows |
| Edit | `src/components/DatabaseView.tsx` — use shared components |
| New  | `src/hooks/useColumnWidths.ts` — localStorage persistence |

No DB migrations needed across all 3 phases.

