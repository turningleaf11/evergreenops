

# Phase 1: Project & Task Detail Pages + Comments System

The first phase focuses on making projects and tasks feel like real working spaces with full detail pages, rich content areas, and a comments/activity system.

## What We're Building

### 1. Project Detail Page (`/projects/:id`)
A full-page workspace for each project with sections:
- **Header**: title (editable), status, priority, owner, assignees, due date, tags, linked goal
- **Tabs/Sections**: Overview, Notes (rich text workspace via TipTap), Tasks (linked tasks list with inline status updates), Comments & Activity
- The Overview section shows description, metadata fields, and a summary of linked tasks/progress
- The Notes section is a full Notion-style doc area using the existing RichTextEditor
- The Tasks section lists linked tasks with ability to create new tasks directly

### 2. Task Detail Page (`/tasks/:id`)
A full-page (or expandable from drawer) workspace for each task:
- **Header**: title (editable), status, priority, assignee, due date, tags, linked project/goal
- **Sections**: Details, Notes (rich text), Subtasks (checklist-style items), Comments & Activity
- Subtasks are lightweight checklist items stored as JSONB on the task row (not full tasks)

### 3. Drawer + Full Page Pattern
- Clicking a project/task in the Execution Hub opens a **slide-out drawer** (Sheet) with a condensed view
- An "Open full page" button in the drawer navigates to `/projects/:id` or `/tasks/:id`
- Full pages are routable and shareable

### 4. Comments & Activity Tables (New)
Two new database tables:
- **`comments`** — `id`, `entity_type` (project/task/issue), `entity_id`, `author_id`, `content` (text), `parent_id` (for threading), `created_at`, `updated_at`
- **`entity_activity`** — `id`, `entity_type`, `entity_id`, `actor_id`, `action` (status_changed, assigned, commented, etc.), `metadata` (jsonb), `created_at`

### 5. Schema Upgrades
Add columns to existing tables:
- **`projects`**: add `priority` (text), `tags` (text[]), `assignees` (uuid[]), `notes_content` (text — rich text HTML)
- **`tasks`**: add `priority` (text), `tags` (text[]), `subtasks` (jsonb — checklist items), `notes_content` (text)

---

## Database Changes

```text
New tables:
  comments (id, entity_type, entity_id, author_id, content, parent_id, created_at, updated_at)
  entity_activity (id, entity_type, entity_id, actor_id, action, metadata, created_at)

Alter projects:
  + priority text default 'medium'
  + tags text[] default '{}'
  + assignees uuid[] default '{}'
  + notes_content text default ''

Alter tasks:
  + priority text default 'medium'
  + tags text[] default '{}'
  + subtasks jsonb default '[]'
  + notes_content text default ''
```

RLS: Both new tables — authenticated can SELECT/INSERT; authors can UPDATE/DELETE their own comments; admins can manage all.

---

## Files

| What | File |
|------|------|
| Project detail page | New: `src/pages/ProjectDetailPage.tsx` |
| Task detail page | New: `src/pages/TaskDetailPage.tsx` |
| Shared comments component | New: `src/components/CommentsSection.tsx` |
| Shared activity feed component | New: `src/components/EntityActivity.tsx` |
| Project/Task drawer | New: `src/components/DetailDrawer.tsx` |
| Execution Hub updates | Edit: `src/pages/ExecutionPage.tsx` — add drawer on click |
| Routes | Edit: `src/App.tsx` — add `/projects/:id`, `/tasks/:id` |
| DB migration | New migration for schema changes |

---

## Future Phases (not in this build)
- **Phase 2**: Kanban/Board views, filtering, sorting, grouping for projects & tasks
- **Phase 3**: Recurring tasks, task templates
- **Phase 4**: Custom fields engine upgrade, database views (saved views, advanced filtering)

