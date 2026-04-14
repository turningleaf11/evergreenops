

# Reminders, Quick Create, Notes UX, and Issues Overhaul

## 1. Reminders — Home widget + header bell, remove from sidebar

- **Remove** "Reminders" from `AppSidebar.tsx` nav and `/reminders` route from `App.tsx`
- **Delete** `src/pages/RemindersPage.tsx`
- **Home page widget** (`Index.tsx`): Add a "Reminders" card showing overdue (red) + upcoming (next 7 days). Checkbox to complete inline. "New Reminder" button opens a mini dialog.
- **Header bell** (`Layout.tsx`): Bell icon with badge count of pending reminders. Dropdown popover shows the list with quick-complete and "View all" that scrolls to the home widget.

## 2. Global Create Menu — tailored forms per entity

Rebuild `GlobalCreateMenu.tsx` so each entity type gets a proper form:

- **Task**: Title, assignee picker, priority (high/med/low), optional project picker
- **Project**: Title, department picker, owner
- **Reminder**: Title, due date/time, delegate-to picker
- **Note**: No dialog — instantly creates an untitled note and navigates to `/notes`
- **Document**: No dialog — instantly creates an untitled doc and navigates to `/docs` (opens inline editor)

## 3. Notes — fix Convert to Doc + improve UX

- **Fix the convert bug**: The `convertToDoc` function in `NotesPage.tsx` inserts into `documents` but likely fails silently due to missing `author_name`. Add proper error handling and pass `author_name` from the profile.
- **Keep Notes separate** in sidebar as requested — but clean up UX:
  - Show note preview snippets in the list
  - Add last-edited timestamp
  - "Convert to Doc" should show a confirmation with the target doc title

## 4. Issues — expand into dual-purpose tracker with categories

### Database migration
Add columns to `issues` table:
- `category` (text, default `'general'`) — values: `tools_systems`, `process`, `people`, `change_request`, `general`
- `assigned_to` (uuid, nullable) — who's responsible for resolving
- `tags` (text[], default `'{}'`)

### UI changes to `IssuesPage.tsx`
- **Category filter tabs** at the top: All | Tools & Systems | Process | Change Requests | General
- **Assignee field** in the create dialog and detail view — pick a team member to own resolution
- **Tags** — free-form tags for cross-cutting concerns
- **Comments section** — reuse the existing `CommentsSection` component (which uses the `comments` table with `entity_type = 'issue'`)
- **Kanban view toggle** — show issues as a board with columns: Open → Identifying → Discussing → Solved/Dismissed (reuse the stage flow that already exists)
- **Linked entities** — in the detail dialog, show ability to link existing tasks/docs using the `entity_links` table

### Create dialog improvements
- Add category picker (dropdown)
- Add assignee picker
- Add optional tags input

## Summary of changes

| Action | File |
|--------|------|
| Edit | `src/components/AppSidebar.tsx` — remove Reminders link |
| Edit | `src/App.tsx` — remove `/reminders` route |
| Delete | `src/pages/RemindersPage.tsx` |
| Edit | `src/pages/Index.tsx` — add reminders widget |
| Edit | `src/components/Layout.tsx` — add bell icon with reminders dropdown |
| Edit | `src/components/GlobalCreateMenu.tsx` — tailored forms, instant-create for notes/docs |
| Edit | `src/pages/NotesPage.tsx` — fix convert-to-doc, UX improvements |
| Edit | `src/pages/IssuesPage.tsx` — categories, assignee, tags, kanban view, comments |
| Migration | Add `category`, `assigned_to`, `tags` columns to `issues` table |

