

# Execution Hub, Issues List (IDS), and Vision Page

## What We're Building

Three new features for the platform:

1. **Execution Hub** — A dedicated space (separate from Databases) for Goals, Projects, and Tasks with hierarchy, quarterly tracking, and progress roll-ups
2. **Issues List with IDS Workflow** — A structured issue triage system: Identify → Discuss → Solve, with automatic task/project creation
3. **Vision Page** — CEO/Admin-only page for company direction (Core Values, Core Focus, 10-Year Target, 3-Year Picture, 1-Year Plan, Quarterly Rocks overview)

## Detailed Design

### 1. Execution Hub (`/execution`)

**Database tables (new migration):**
- `goals` — id, title, description, quarter (e.g. "2026-Q2"), year, status (on_track / behind / at_risk / done / not_done), owner_id, department_id, created_by, progress (0-100), created_at, updated_at
- `projects` — id, title, description, goal_id (FK → goals), status (not_started / in_progress / done / blocked), owner_id, department_id, due_date, created_by, created_at, updated_at
- `tasks` — id, title, description, project_id (FK → projects, nullable), goal_id (FK → goals, nullable), status (todo / in_progress / done), assigned_to (FK → profiles.user_id), due_date, created_by, created_at, updated_at

**RLS:** Authenticated users can read all; authenticated users can create; owners/assignees and admins can update/delete.

**UI — New page `src/pages/ExecutionPage.tsx`:**
- Tab bar: **Goals** | **Projects** | **Tasks**
- **Goals tab**: Grouped by quarter. Each goal shows title, owner, status badge, progress bar (auto-calculated from linked projects/tasks), and expandable list of linked projects
- **Projects tab**: List/Kanban view of all projects. Each shows linked goal, status, owner, task count
- **Tasks tab**: Personal task list (filtered to current user by default, admin can see all). Shows task title, status, due date, linked project/goal
- Inline creation for all three levels
- Click a goal → expand to see projects → expand to see tasks (drill-down)

**Sidebar:** Add "Execution Hub" with a `Target` icon in the main nav, between Home and Docs.

### 2. Issues List with IDS (`/issues`)

**Database table (new migration):**
- `issues` — id, title, description, raised_by (FK), department_id, priority (1/2/3), status (open / identifying / discussing / solved / dismissed), root_cause (text), discussion_notes (text), resolution (text), resolved_action_type (todo / project / none), resolved_action_id (uuid, nullable — links to created task/project), created_at, updated_at

**RLS:** Authenticated can read all and create. Admins can update/delete all; creators can update their own.

**UI — New page `src/pages/IssuesPage.tsx`:**
- List of open issues, sortable by priority and date
- Click an issue → opens a detail panel/dialog with the IDS flow:
  - **Step 1 — Identify**: Edit/confirm root cause text
  - **Step 2 — Discuss**: Add discussion notes
  - **Step 3 — Solve**: Choose action — "Create Task," "Create Project," or "Dismiss." If creating, a quick form appears to set title/assignee, then the issue is marked solved and linked
- Solved issues move to a "Resolved" section with a record of the decision
- Anyone can raise an issue; admins solve them

**Sidebar:** Add "Issues" with `AlertCircle` icon in main nav.

### 3. Vision Page (`/vision`)

**Database table (new migration):**
- `vision` — id, section (enum: core_values / core_focus_purpose / core_focus_niche / ten_year_target / three_year_picture / one_year_plan / quarterly_rocks_summary), content (text/jsonb), sort_order, updated_at, updated_by

**RLS:** Authenticated can read; admins can insert/update/delete.

**UI — New page `src/pages/VisionPage.tsx`:**
- Clean, single-column editorial layout
- Sections rendered in order: Core Values, Core Focus (Purpose + Niche), 10-Year Target, 3-Year Picture, 1-Year Plan, Quarterly Rocks (auto-pulled from goals table)
- Admin sees inline edit buttons; content is editable in-place
- Read-only for non-admins (but the route is admin-only per your preference)

**Sidebar:** Add "Vision" with `Eye` icon in the Admin section (since CEO/admin only).

## Files Changed

| Area | Files |
|------|-------|
| Migration | New SQL: `goals`, `projects`, `tasks`, `issues`, `vision` tables with RLS |
| Execution Hub | New: `src/pages/ExecutionPage.tsx`, `src/components/GoalCard.tsx`, `src/components/ProjectCard.tsx`, `src/components/TaskItem.tsx` |
| Issues | New: `src/pages/IssuesPage.tsx`, `src/components/IssueDetail.tsx` |
| Vision | New: `src/pages/VisionPage.tsx` |
| Routing | Edit: `src/App.tsx` — add `/execution`, `/issues`, `/vision` routes |
| Navigation | Edit: `src/components/AppSidebar.tsx` — add nav items |
| Types | Auto-updated: `src/integrations/supabase/types.ts` |

## What We're NOT Changing
- Top Priorities on CEO Dashboard — untouched
- Existing Databases page — stays as-is for generic/custom databases
- L10 meetings — excluded per your request

