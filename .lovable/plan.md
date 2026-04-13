

# Phase 4: Custom Database Fields + Advanced Database Experience

## Summary
Upgrade the database engine to support more field types, inline column management (add/rename/reorder/delete columns), and add filtering, sorting, and grouping controls to database views. Also add a record detail panel so database rows can be opened and worked inside.

---

## 1. Expanded Field Types

Add these column types to `ColumnType` in `mock-data.ts`:
- `long_text`, `currency`, `email`, `phone`, `status`, `tags`, `file`

Update `DatabaseItemEditor.tsx` field renderers and `DatabaseView.tsx` cell renderers to handle all new types. Currency renders with `$` prefix + number formatting. Email/phone render as clickable links. Status works like select but with colored dot indicators. Tags renders as chips. File is a placeholder for now (text URL field).

## 2. Inline Column Management

Add a **column manager** to `DatabaseView.tsx`:
- "+" button at the end of the table header to add a new column (name + type picker)
- Right-click or kebab menu on column headers: rename, change type, reorder (move left/right), delete
- Column changes persist by updating the `columns` JSONB on the `databases_meta` row via Supabase

New component: `src/components/ColumnManager.tsx` — popover for add/edit column with type selector and options editor (for select/multi_select/status).

## 3. Database View Controls (Filter, Sort, Group)

Add a toolbar above database views with:
- **Filter**: pick column → operator (is, is not, contains, is empty) → value — multiple filters, AND logic
- **Sort**: pick column + direction — multiple sort keys
- **Group**: pick a select/status column to group rows into sections (table & list views) or lanes (kanban)

New component: `src/components/DatabaseViewControls.tsx` — filter/sort/group bar with popover editors. Applied client-side on the rows array before rendering.

## 4. Record Detail Panel

When clicking a database row, open a **side sheet** (not just the edit dialog) with:
- Full field display + inline editing
- Rich text notes area (already exists as `_notes`)
- Comments section (reuse `CommentsSection` with entity_type = 'database_row')
- Activity feed

New component: `src/components/DatabaseRecordDetail.tsx` — Sheet-based detail view. Edit `DatabaseView.tsx` to open this on row click instead of the dialog.

## 5. Saved Views (Stretch)

Add a `database_views` table:
- `id`, `database_id`, `name`, `view_type` (table/kanban/list), `filters` (jsonb), `sorts` (jsonb), `group_by` (text), `column_order` (text[]), `created_by`, `created_at`

Users can save current filter/sort/group/view config as a named view and switch between saved views via tabs above the database.

---

## Database Changes

```text
New table: database_views
  id uuid PK
  database_id uuid references databases_meta(id)
  name text
  view_type text default 'table'
  filters jsonb default '[]'
  sorts jsonb default '[]'
  group_by text default null
  column_order text[] default '{}'
  created_by uuid
  created_at timestamptz default now()

RLS: authenticated can SELECT/INSERT; creators can UPDATE/DELETE.
```

No changes to `databases_meta` or `database_rows` schemas — columns are already JSONB and flexible.

---

## Files

| What | File |
|------|------|
| Expanded ColumnType | Edit: `src/lib/mock-data.ts` |
| New field renderers | Edit: `src/components/DatabaseItemEditor.tsx`, `src/components/DatabaseView.tsx` |
| Column manager | New: `src/components/ColumnManager.tsx` |
| View controls (filter/sort/group) | New: `src/components/DatabaseViewControls.tsx` |
| Record detail panel | New: `src/components/DatabaseRecordDetail.tsx` |
| Saved views | Edit: `src/pages/DatabasesPage.tsx` |
| DB migration | New migration for `database_views` table |

