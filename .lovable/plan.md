

# Flexible Database Engine

## Change
Make databases generic containers (like Notion) instead of hardcoded goal/project/task types. Users can create any database with custom fields — e.g., "Bug Tracker", "Content Calendar", "Meeting Notes", "Inventory", etc.

## Data Model

**Database** — a named container with a schema
- id, title, description, icon, departmentId, createdBy, columns (field definitions)

**Database Column** — defines a field in that database
- id, name, type (text | number | select | multi_select | date | person | checkbox | url | progress), options (for select types), required

**Database Row** — a record in a database
- id, databaseId, values (key-value map of columnId → value), createdAt, updatedAt

## Pre-built Templates
Instead of hardcoded types, offer **templates** when creating a new database:
- Goals Tracker (status, priority, progress, assignee, due date)
- Project Board (status, priority, assignee, timeline, tags)
- Task List (status, priority, assignee, due date)
- Bug Tracker (severity, status, reporter, assignee)
- Content Calendar (publish date, status, author, channel)
- Blank (start from scratch)

## What Changes

### New/Modified Files
- `src/lib/mock-data.ts` — replace `DatabaseItem` with `Database`, `DatabaseColumn`, `DatabaseRow` interfaces; add sample databases with different schemas; remove hardcoded status/priority configs (move into per-database column options)
- `src/pages/DatabasesPage.tsx` — show list of databases; click into one to see its rows in table/kanban/list views; "New Database" button opens template picker
- `src/components/DatabaseView.tsx` — generic renderer for any database's rows across all three view modes, reading columns dynamically
- `src/components/DatabaseItemEditor.tsx` — dynamic form that renders fields based on the database's column schema
- `src/components/CreateDatabaseDialog.tsx` — template picker + custom column editor

### Sidebar
- "Databases" section shows list of all databases (not just one page)

## Build Order
1. Define new generic data model interfaces and mock data (2-3 sample databases with different schemas)
2. Build database list page showing all databases
3. Build dynamic table/kanban/list views that read column definitions
4. Build create/edit dialogs with dynamic form fields
5. Update sidebar to list individual databases

