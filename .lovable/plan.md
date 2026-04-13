

# Projects ↔ Goals ↔ Tasks Linking + Inline Doc Editing

## Part 1: Relational Linking (Goals → Projects → Tasks)

### Data Model Changes (`src/lib/mock-data.ts`)
- Add a `"relation"` column type to `ColumnType`
- Relation columns store a reference: `{ databaseId: string, rowId: string }` or an array of them
- Add a `relationConfig?: { databaseId: string; multiple?: boolean }` field to `DatabaseColumn` so each relation column knows which database it points to
- Update the **Goals Tracker** template to include a `projects` relation column pointing at Project Board
- Update the **Project Board** template to include a `goal` relation column (back to Goals) and a `tasks` relation column (pointing at Task List)
- Update the **Task List** template to include a `project` relation column (back to Project Board)
- Update sample `databaseRows` to include relation values linking existing rows

### Rendering Relations (`src/components/DatabaseView.tsx`)
- When rendering a `relation` column cell, look up the referenced row(s) by ID and display the title as a clickable chip/badge
- Clicking a relation chip navigates to that database + row

### Editing Relations (`src/components/DatabaseItemEditor.tsx`)
- For `relation` type columns, render a searchable dropdown that lists rows from the target database
- Support single and multi-select based on `relationConfig.multiple`

### Wire up in `DatabasesPage.tsx`
- Pass the full `allDatabases` and `allRows` arrays down so relation lookups work across databases

## Part 2: Inline Doc Editing (Notion-style)

### Replace Dialog Editing with Inline Editing (`src/pages/DocsPage.tsx`)
- Remove the `DocEditor` dialog for editing (keep it only for the "New Page" flow where you set title/parent/access)
- When a doc is selected, the content area becomes directly editable:
  - Title becomes an `<input>` (borderless, large font) that saves on blur/change
  - Content area shows the `RichTextEditor` directly (not in a dialog) with the toolbar at the top
  - Tags become inline editable chips
  - Metadata (author, date, visibility) shown as subtle inline controls
- Auto-save on content change (debounced ~1s) — no explicit Save button needed
- The doc content panel switches between "view mode" (for non-admin) and "edit mode" (for admin, always-on)

### Simplify `DocEditor` Component
- Keep `DocEditor` dialog only for creating new pages (setting title, parent, access before creation)
- Rename to `NewDocDialog` for clarity

## Files Changed

| File | Change |
|------|--------|
| `src/lib/mock-data.ts` | Add `relation` to ColumnType, add `relationConfig` to DatabaseColumn, update templates + sample data |
| `src/components/DatabaseView.tsx` | Render relation cells as clickable chips |
| `src/components/DatabaseItemEditor.tsx` | Add relation column editor (searchable dropdown) |
| `src/pages/DatabasesPage.tsx` | Pass databases/rows for cross-db lookups |
| `src/pages/DocsPage.tsx` | Replace dialog editing with inline editing, auto-save, borderless title input, embedded RichTextEditor |
| `src/components/DocEditor.tsx` | Simplify to new-doc-only dialog |

## Build Order
1. Data model: add relation type + update templates/sample data
2. DatabaseItemEditor: relation column editing UI
3. DatabaseView: render relation cells
4. DatabasesPage: pass cross-db data
5. DocsPage: inline editing with embedded RichTextEditor + auto-save
6. Simplify DocEditor to new-doc-only

