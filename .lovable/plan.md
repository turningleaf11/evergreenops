

# Fix Settings Persistence + User Management + Center Peek Mode

## Issue 1: Settings not saving

**Root cause**: There is no row in the `workspaces` table. The fetch returns null, so `state.id` stays null, and `saveToDb` skips with `if (!s.id) return`. Nothing ever gets written.

**Fix**:
- Add a migration that seeds a default workspace row
- Update `WorkspaceContext` to auto-create a workspace row if none exists (upsert on first save)
- Remove the `as any` casts since types now include `accent_color`
- Upload logo to the `files` storage bucket instead of storing base64 data URLs in the DB column (data URLs can be too large for text columns and won't persist reliably)

## Issue 2: Edit/delete users in Settings > Users & Roles

Currently users can only change role and department. Add:
- **Edit**: Inline editing of user name, clicking opens an edit mode or small popover
- **Delete**: A delete button (with confirmation) that removes the user's profile and role entries. Cannot delete the primary admin. Will call a backend function to delete from `auth.users` (requires service role key via edge function)
- Create an `admin-delete-user` edge function that uses the service role key to delete from auth

## Issue 3: Center peek (modal) option for detail view

The uploaded image shows Notion-style open modes: Side peek, Center peek, Full page, New tab. Currently `DetailDrawer` only does side peek (Sheet). Add:
- A `viewMode` preference: `"side"` | `"center"` | `"full"`
- **Side peek**: Current Sheet behavior (default)
- **Center peek**: Opens as a Dialog (centered modal overlay) with the same content
- **Full page**: Navigates to the full page route (existing behavior via the button)
- Add a small dropdown/popover in the drawer header to switch between modes, similar to the Notion UI in the screenshot
- Store preference in localStorage so it persists
- Refactor `DetailDrawer` to render either a `Sheet` or `Dialog` based on the mode

## Files changed

| Action | File |
|--------|------|
| Migration | Seed default workspace row |
| Edit | `src/contexts/WorkspaceContext.tsx` — auto-create workspace if missing, upload logo to storage |
| Edit | `src/pages/SettingsPage.tsx` — add edit/delete user actions, upload logo to storage bucket |
| New | `supabase/functions/admin-delete-user/index.ts` — delete user via service role |
| Edit | `src/components/DetailDrawer.tsx` — support side peek, center peek, full page modes with mode switcher |
| Edit | `src/pages/ExecutionPage.tsx` — pass view mode state to DetailDrawer |
| Edit | `src/pages/DepartmentPage.tsx` — pass view mode state to DetailDrawer |

