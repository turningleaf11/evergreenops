

# Department Overview Page Enhancement

## Summary
Make department pages into real team hubs by surfacing department-specific docs, databases, tasks, projects, goals, and activity — all data that already exists but isn't being displayed.

## Changes

### 1. Fix Docs & Databases Filtering
Currently fetches all docs/databases but never filters or renders them. Fix: filter client-side where `shared_with.departmentIds` includes the department ID OR `visibility = 'workspace'`, then render in the Overview tab as linked card lists.

### 2. Add Department Tasks & Projects Summary
Query `tasks` and `projects` where `department_id` matches. Show counts by status and a compact list of active items (in progress / to do) with links to detail pages.

### 3. Add Department Goals
Query `goals` where `department_id` matches and `year` is current year. Show goal cards with progress bars and status badges.

### 4. Add Recent Activity Feed
Query `activity_events` where `department_id` matches, limited to recent entries. Show as a compact timeline in the Overview tab.

### 5. Add Department Issues Summary
Query `issues` where `department_id` matches and `status = 'open'`. Show count and compact list.

### 6. Reorganize Overview Tab Layout
Structure the Overview tab into clear sections:
- Announcements (pinned, existing)
- Goals (new — progress bars)
- Active Projects & Tasks (new — compact lists with status)
- Open Issues (new — count + list)
- Shared Docs & Databases (fixed — filtered, linked)
- Team Members (existing)
- Recent Activity (new — timeline)

## Files

| What | File |
|------|------|
| Department page overhaul | Edit: `src/pages/DepartmentPage.tsx` — add queries for goals/tasks/projects/issues/activity, fix doc/db filtering, render all sections |

No database changes needed — all the required columns (`department_id` on tasks, projects, goals, issues; `shared_with` on docs/databases; `department_id` on activity_events) already exist.

