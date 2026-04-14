

# Batch 1 + Batch 2 Implementation (minus Standup)

This is a large batch covering bug fixes, editor improvements, goal enhancements, notes, reminders, a global create button, and project-doc linking. Here's everything broken into ordered steps.

---

## Batch 1: Fixes + Quick Wins

### 1. Fix onboarding banner not dismissing after completion
**Bug**: `onboardingProgress` is hardcoded to divide by 5 (`training-progress.ts` line 95) instead of using the actual step count from the database. When all steps are completed, the banner shows "all done" but never auto-dismisses.
- Pass actual step count into the progress calculation
- Auto-dismiss when all steps are checked (or at least show 100% correctly)

### 2. Fix custom branding not saving
**Bug**: The `persist` function in `WorkspaceContext.tsx` fires the DB update inside `setState`, which means it reads stale `prev.id`. Also the `as any` cast suggests a type mismatch. The workspace RLS only allows admin writes, but the update runs for any user.
- Move the DB update out of `setState` so it uses the correct state
- Ensure only admins trigger writes
- Verify the column names match the actual table schema

### 3. Remove "IDS" from Issues page title
Rename `"Issues (IDS)"` to `"Issues"` in both `IssuesPage.tsx` (line 116) and `ExecutionPage.tsx` (wherever it appears in the issues tab).

### 4. Add toggle list to doc editor
- Install `@tiptap/extension-details`, `@tiptap/extension-detail-summary`, `@tiptap/extension-detail-content` (or use the TipTap details extension bundle)
- Register in `RichTextEditor.tsx`
- Add "Toggle List" to slash command menu in `SlashCommandMenu.tsx`

### 5. Add simple tables to doc editor
- Install `@tiptap/extension-table`, `@tiptap/extension-table-row`, `@tiptap/extension-table-cell`, `@tiptap/extension-table-header`
- Register in `RichTextEditor.tsx`
- Add "Table" to slash command menu
- Add basic table CSS to `RichTextEditor.css`

### 6. Global create button (header)
Add a `+` / "Create" dropdown button in the Layout header bar (`Layout.tsx`) with options:
- New Task
- New Project
- New Reminder (Batch 2)
- New Doc
Each opens a lightweight dialog to create the item inline, then navigates or toasts on success.

---

## Batch 2: Features

### 7. SMART-ish Goals
Enhance the goals table and UI:
- **Migration**: Add columns to `goals`: `measurable_target` (text), `deadline` (date), `key_results` (jsonb, default `[]`), `alignment_notes` (text)
- Update goal creation dialog in `ExecutionPage.tsx` to include these fields
- Show key results as a small checklist inside the goal card when expanded
- Allow editing key results inline

### 8. Notes (scratchpad that can convert to Doc)
- **Migration**: Create `notes` table: `id`, `user_id`, `title`, `content` (text/html), `created_at`, `updated_at`, `converted_doc_id` (nullable uuid). RLS: users can CRUD their own notes, admins can see all.
- Add "Notes" to sidebar nav
- Build a simple `NotesPage.tsx` with a list + inline editor (reuse RichTextEditor)
- Add a "Convert to Doc" button that creates a document from the note content and sets `converted_doc_id`

### 9. Project-Doc linking
- **Migration**: Add `project_id` column (nullable uuid) to `documents` table
- In `ProjectDetailPage.tsx`, add a "Docs" section showing linked documents and a button to create a new doc linked to that project
- In `DocsPage.tsx`, show project badge on docs that are linked

### 10. Reminders with delegation
- **Migration**: Create `reminders` table: `id`, `user_id` (creator), `assigned_to` (uuid, nullable — for delegation), `title`, `description`, `due_at` (timestamptz), `completed` (boolean default false), `created_at`, `updated_at`. RLS: users see their own + assigned reminders, admins see all.
- Build a `RemindersPage.tsx` or integrate into the home page as a widget
- Show overdue reminders prominently
- Allow assigning a reminder to another team member (delegation)
- Add "Reminder" option to the global create button

### 11. Doc-to-Doc and Task-to-Doc linking
- **Migration**: Create `entity_links` table: `id`, `source_type` (text), `source_id` (uuid), `target_type` (text), `target_id` (uuid), `created_by`, `created_at`. RLS: authenticated can view/create.
- In task detail page, add ability to link existing docs
- In doc detail page, show linked tasks/docs as backlinks
- This is a generic linking system that can connect any two entities

---

## Summary of database changes
1. `goals` — add `measurable_target`, `deadline`, `key_results`, `alignment_notes`
2. New table: `notes`
3. `documents` — add `project_id`
4. New table: `reminders`
5. New table: `entity_links`

## Files changed/created (estimated)
| Action | File |
|--------|------|
| Edit | `src/lib/training-progress.ts` — fix progress calc |
| Edit | `src/contexts/WorkspaceContext.tsx` — fix persist |
| Edit | `src/pages/IssuesPage.tsx` — remove "IDS" |
| Edit | `src/pages/ExecutionPage.tsx` — remove "IDS", enhance goals UI |
| Edit | `src/components/RichTextEditor.tsx` — add table + toggle extensions |
| Edit | `src/components/SlashCommandMenu.tsx` — add table + toggle commands |
| Edit | `src/components/RichTextEditor.css` — table styles |
| Edit | `src/components/Layout.tsx` — global create button |
| Edit | `src/components/AppSidebar.tsx` — add Notes link |
| Edit | `src/pages/ProjectDetailPage.tsx` — linked docs section |
| Edit | `src/pages/DocsPage.tsx` — show project badge |
| Edit | `src/pages/TaskDetailPage.tsx` — link docs |
| New | `src/pages/NotesPage.tsx` |
| New | `src/pages/RemindersPage.tsx` |
| New | `src/components/GlobalCreateMenu.tsx` |
| Edit | `src/App.tsx` — add routes for Notes, Reminders |
| Migrations | 5 SQL migrations |

This is a substantial batch. I'll work through it sequentially, starting with the bug fixes (quickest wins), then the editor improvements, then the larger features.

