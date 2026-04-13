

# Phase 3: Recurring Tasks + Task Templates

## Summary
Add recurring task support with automatic next-occurrence generation, and a task templates system for reusable task configurations.

---

## 1. Recurring Tasks

### Database Changes
Add columns to `tasks` table:
- `is_recurring` boolean default false
- `recurrence_rule` jsonb default null — stores `{ frequency: 'daily'|'weekly'|'monthly'|'custom', interval: number, days_of_week?: number[], end_date?: string, parent_recurring_id?: string }`
- `recurring_parent_id` uuid default null — links generated occurrences back to the original template task

### How It Works
- When creating/editing a task, user can toggle "Make recurring" and pick frequency (daily, weekly, monthly, custom interval)
- Optional end date or "no end date"
- When a recurring task is marked `done`, an edge function (or client-side logic) auto-generates the next occurrence with the same title, description, subtasks, tags, priority, assignee — but a new due date shifted by the recurrence interval
- Completed recurring instances are preserved in history (queryable by `recurring_parent_id`)
- The Execution Hub task list shows a small repeat icon on recurring tasks

### UI Changes
- **TaskDetailPage.tsx**: Add a "Recurrence" section in the details tab — toggle + frequency picker + end date
- **ExecutionPage.tsx**: When updating a task status to `done`, check if recurring and auto-create next occurrence
- Small `Repeat` icon badge on recurring tasks in list/board/table views

---

## 2. Task Templates

### Database Changes
New table: `task_templates`
- `id` uuid PK
- `title` text
- `description` text default ''
- `subtasks` jsonb default '[]'
- `tags` text[] default '{}'
- `priority` text default 'medium'
- `assignee_id` uuid nullable
- `due_date_offset_days` integer nullable — e.g. "7" means due 7 days from creation
- `recurrence_rule` jsonb nullable
- `custom_fields` jsonb default '{}'
- `created_by` uuid
- `created_at`, `updated_at` timestamps

RLS: authenticated can SELECT/INSERT; creators and admins can UPDATE/DELETE.

### UI Changes
- **New component**: `TaskTemplateManager.tsx` — dialog/panel to list, create, edit, and delete templates
- **ExecutionPage.tsx**: "New Task" dropdown gets a "From Template" option that opens a template picker; selecting one pre-fills the create-task form
- **TaskDetailPage.tsx**: "Save as Template" button in the task header that captures the current task's config into a new template

---

## Files

| What | File |
|------|------|
| Recurring task logic + UI | Edit: `src/pages/TaskDetailPage.tsx` |
| Auto-create next occurrence | Edit: `src/pages/ExecutionPage.tsx` |
| Recurring icons in views | Edit: `src/components/execution/KanbanBoard.tsx`, `TableView.tsx` |
| Task templates component | New: `src/components/TaskTemplateManager.tsx` |
| Template picker in create flow | Edit: `src/pages/ExecutionPage.tsx` |
| DB migration | New migration: add recurring columns to tasks + create task_templates table |

No edge function needed — the next-occurrence logic runs client-side when marking a task done.

