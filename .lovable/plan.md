

# UI Improvements: Workspace Config, Departments, Docs Layout, AI Fix

## Issues Identified

1. **Workspace name not editable** — The sidebar header hardcodes "TeamSpace". The Settings page has a workspace name field but it doesn't propagate anywhere (local state only).
2. **No logo** — Sidebar header shows a hardcoded "T" letter box.
3. **Departments not editable** — Departments are hardcoded in `mock-data.ts`. No admin UI to add, edit, or delete them.
4. **AI not working** — The edge functions and `LOVABLE_API_KEY` are correctly configured. The issue is likely that Lovable Cloud needs to be enabled to deploy the edge functions. Will verify and ensure the functions are deployed.
5. **Docs UI feels small** — Content area uses `max-w-3xl` constraint, doc sidebar is `w-72`. User wants full-width content.

## What Gets Built

### 1. Workspace Context (`src/contexts/WorkspaceContext.tsx`)
- Shared state for workspace name, description, and logo URL
- Persisted in localStorage
- Consumed by sidebar header and settings page
- Logo stored as a data URL (from file input)

### 2. Sidebar Header Update (`AppSidebar.tsx`)
- Read workspace name + logo from WorkspaceContext
- Show logo image if set, fall back to first-letter box
- Display workspace name dynamically

### 3. Settings Page — Workspace Tab Update (`SettingsPage.tsx`)
- Wire workspace name/description inputs to WorkspaceContext (instead of local state)
- Add logo upload input (file picker, converts to data URL)
- Add a "Departments" management section: list departments with inline edit for name/description, add new, delete

### 4. Department Management
- Move departments from static `mock-data.ts` export to a React context (`src/contexts/DepartmentsContext.tsx`)
- Admin can add, rename, update description, and delete departments from Settings
- Sidebar and all department references read from context

### 5. Docs Layout — Full Width
- Remove `max-w-3xl` constraint from `InlineDocEditor`
- Use full available width in the content panel
- Increase prose max-width or remove it entirely

### 6. AI Chat Fix
- Ensure Lovable Cloud is enabled so edge functions deploy
- No code changes needed — the functions are correctly implemented

## Files

| File | Action |
|------|--------|
| `src/contexts/WorkspaceContext.tsx` | **Create** — Workspace name, description, logo state + localStorage |
| `src/contexts/DepartmentsContext.tsx` | **Create** — Editable departments state + localStorage |
| `src/components/AppSidebar.tsx` | **Edit** — Use workspace context for header, departments context for nav |
| `src/pages/SettingsPage.tsx` | **Edit** — Wire workspace settings, add logo upload, add departments management tab |
| `src/pages/DocsPage.tsx` | **Edit** — Remove max-w-3xl, full-width content |
| `src/pages/DepartmentPage.tsx` | **Edit** — Read from departments context |
| `src/App.tsx` | **Edit** — Wrap with WorkspaceProvider and DepartmentsProvider |
| `src/pages/Index.tsx` | **Edit** — Read from departments context if needed |

## Build Order
1. Create WorkspaceContext + DepartmentsContext
2. Update AppSidebar to use both contexts
3. Update SettingsPage with workspace editing, logo upload, and department management
4. Update DepartmentPage to use departments context
5. Update DocsPage for full-width layout
6. Verify AI edge functions are deployed

