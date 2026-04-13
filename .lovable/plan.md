

# Keep Users on Department Page: Slide-Out Drawers for Everything

## Problem
Clicking docs, tasks, or projects on the department page navigates away. User wants to stay on the department page unless they explicitly choose to leave.

## Changes

### 1. Tasks & Projects → Use existing `DetailDrawer`
**File**: `src/pages/DepartmentPage.tsx`

- Import `DetailDrawer` component (already supports both `type="task"` and `type="project"`)
- Add state: `drawerItem`, `drawerType`, `drawerOpen`
- Replace `<Link to={/projects/${id}}>` and `<Link to={/tasks/${id}}>` with `onClick` handlers that open the drawer
- Wire `onStatusChange` to update status via Supabase and refresh local state
- Pass `getName` function (already exists in the component)

### 2. Docs → New Doc Preview Sheet
**File**: `src/pages/DepartmentPage.tsx`

- Add a `Sheet` (slide-out) for doc preview — shows title, content (read-only `RichTextEditor`), author, and an "Open full page" button that navigates to `/docs?doc=${id}`
- Replace `<Link to={/docs?doc=${id}}>` with `onClick` that fetches the doc content and opens the sheet
- Import `Sheet`, `SheetContent`, `SheetHeader`, `SheetTitle` and `RichTextEditor`

### 3. Summary of UX
- Clicking a task/project → slide-out drawer with status, priority, owner, comments, and "Open full page" button
- Clicking a doc → slide-out sheet with title, content preview, and "Open full page" button
- User never leaves the department page unless they explicitly click "Open full page"

## Files
| What | File |
|------|------|
| Add drawers for tasks/projects/docs | Edit: `src/pages/DepartmentPage.tsx` |

No new components or database changes needed.

