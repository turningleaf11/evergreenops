

# Access Control for Docs & Databases

## Current State
Docs and databases each have a single `departmentId` field. If it's set, the item appears on that department's page. If `null`, it's workspace-wide. There's no UI to set this when creating/editing, and no way to share with multiple departments or specific people.

## What Changes

### 1. Replace `departmentId` with flexible access model
Update `DocPage` and `Database` interfaces to support granular sharing:

```text
visibility: "workspace" | "departments" | "private"
sharedWith: {
  departmentIds: string[]    // multiple departments
  memberIds: string[]        // specific people
}
```

- **Workspace** — everyone can see it (replaces `departmentId: null`)
- **Departments** — only selected departments see it (supports multiple)
- **Private** — only explicitly listed members see it

### 2. Access Picker component (`src/components/AccessPicker.tsx`)
A reusable UI widget used in both DocEditor and CreateDatabaseDialog:
- Radio group for visibility level (Workspace / Departments / Private)
- When "Departments" is selected: multi-select checklist of all departments
- When "Private" is selected: multi-select checklist of team members
- Shows current access summary as badges

### 3. Update DocEditor dialog
- Add the AccessPicker below the existing fields
- `onSave` callback passes `visibility` and `sharedWith` data
- Default new docs to "Workspace" visibility

### 4. Update CreateDatabaseDialog
- Add a second step or section with the AccessPicker
- `onCreate` callback includes visibility and sharedWith
- Default new databases to "Workspace" visibility

### 5. Update DepartmentPage filtering
- Change `docPages.filter(d => d.departmentId === id)` to check `d.sharedWith.departmentIds.includes(id)`
- Same for databases
- Also show items where the current user's ID is in `sharedWith.memberIds`

### 6. Update mock data
- Migrate existing `departmentId` values to the new `sharedWith` structure
- Remove `departmentId` field from interfaces

## New Files
- `src/components/AccessPicker.tsx`

## Modified Files
- `src/lib/mock-data.ts` — new interfaces + migrated data
- `src/components/DocEditor.tsx` — add AccessPicker
- `src/components/CreateDatabaseDialog.tsx` — add AccessPicker
- `src/pages/DepartmentPage.tsx` — updated filtering logic
- `src/pages/DocsPage.tsx` — filter docs by current user's access
- `src/pages/DatabasesPage.tsx` — filter databases by access

## Build Order
1. Update data model and migrate mock data
2. Build AccessPicker component
3. Integrate into DocEditor and CreateDatabaseDialog
4. Update filtering on DepartmentPage, DocsPage, and DatabasesPage

