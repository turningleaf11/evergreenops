

# Execution Hub Redesign — Goals, Projects, Tasks

All work stays inside `/execution`. No new top-level routes.

## Mental Model

| Layer | Feel | Click opens |
|---|---|---|
| **Goals** | Strategic dashboard | Goal Peek (side drawer) |
| **Projects** | Collaborative workspace | Project Peek (full-width drawer / center modal) |
| **Tasks** | Fast checklist | Task Peek (compact side panel) |

---

## 1. Goals — Strategic Overview

**Page** (`/execution`, Goals tab):
- Header: "Goals" + filters (Quarter dropdown, Year dropdown, Department dropdown, "Group by: Department / Quarter / None")
- Card grid (2–3 cols), grouped by selected dimension with subtle section headers
- **Goal Card**: title • muted 1-line description • slim progress bar • 2–3 metric chips • "X projects" pill • owner avatar

**Metrics logic (hybrid)**:
- If `key_results` array has entries → show top 2–3 (label + current/target)
- Else → auto rollups: `% projects done`, `# active projects`, `next due date`

**Goal Peek (side drawer, ~640px)**:
- Header: title (inline editable), description, big progress bar, owner, qtr/year, status
- **Section: Key Results** — list of `{label, target, current}` rows, inline editable, "+ Add key result"
- **Section: Key Projects** — linked project cards (status dot, title, owner, progress) + "Link project" picker (search existing or "Create new project linked to this goal")
- **Section: Strategy / Notes** — full TipTap editor (`alignment_notes` field)
- **Section: Comments & Activity** — reuse `CommentsSection` + `EntityActivity` (entity_type=`goal`)

---

## 2. Projects — Collaborative Workspace

Keep existing `ProjectDetailPage` structure but elevate it. It already opens at `/execution/projects/:id` (or peek per `mem://ui/peek-view-modes`).

**Enhancements**:
- Header chip showing **linked Goal** (clickable → opens Goal Peek)
- Stacked workspace layout (no tabs — keeps "long doc" feel):
  1. **Metadata strip** (already exists — keep clean)
  2. **Notes / Workspace** — TipTap, primary area (already exists)
  3. **Tasks** — collapsible (already exists)
  4. **Documents** — collapsible (already exists)
  5. **NEW: Discussion** — `CommentsSection` for `entity_type=project` (threaded, reactions, mentions). This is the collaboration heart.
- ActivitySidebar stays on right (already exists)

This makes projects feel like a Notion page + comment thread + task list in one room.

---

## 3. Tasks — Minimal Execution

**List view**: untouched (per memory, already polished Card-Enhanced List).

**NEW: TaskPeekPanel** (side drawer ~480px, replaces full-page navigate):
- Title (inline editable)
- Status + Priority badges (clickable)
- Assignee + Due date (popovers)
- Description (expandable textarea)
- Checklist / subtasks (existing schema)
- Attachments
- Small muted "Project: X" chip (clickable → opens Project Peek)
- Compact comment thread at bottom (collapsed by default)
- **Keep `TaskDetailPage` route** intact for deep-linking; just don't navigate to it from the list. Add a "↗ Open full page" link in the panel header.

**Wiring**: Replace `navigate('/tasks/:id')` calls in execution list with `setPeekTaskId(id)` opening the panel. Existing route stays alive.

---

## Files to Touch

**New**:
- `src/components/execution/GoalPeek.tsx` — drawer with all sections
- `src/components/execution/GoalCard.tsx` — strategic card
- `src/components/execution/TaskPeekPanel.tsx` — lightweight task drawer
- `src/components/execution/LinkProjectPicker.tsx` — search + create-linked

**Modified**:
- `src/pages/ExecutionPage.tsx` — Goals tab → card grid + grouping; wire peeks
- `src/pages/ProjectDetailPage.tsx` — add Goal chip in header + Discussion section
- `src/components/execution/KanbanBoard.tsx` / `TableView.tsx` / `DataTableView.tsx` — task clicks open TaskPeekPanel instead of navigating

**Reused (no changes)**:
- `CommentsSection`, `EntityActivity`, `ActivitySidebar`, `RichTextEditor`, `TaskDetailPage` (kept dormant)

## DB

No schema changes. Everything fits existing fields:
- `goals.key_results` (jsonb), `alignment_notes` (text), `quarter`, `year`, `department_id`
- `projects.goal_id` (FK link)
- `comments` table already polymorphic (`entity_type`/`entity_id`)

## Out of Scope

- Whiteboards (still pending separate decision)
- Gmail (separate workstream)
- Tasks list redesign (intentionally untouched)

