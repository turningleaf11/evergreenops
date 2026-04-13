

# Department Page: Command Center Upgrade

Combines the previously proposed UI fixes (focus rings, date picker, activity) with a full department page redesign.

## Part 1: Task/Project Detail Page Fixes

### Remove blue focus ring on selects
Add `focus:ring-0 focus-visible:ring-0 focus:ring-offset-0` to all `SelectTrigger` elements in `TaskDetailPage.tsx` and `ProjectDetailPage.tsx`.

### Hide dropdown chevron
Add `[&>svg:last-child]:hidden` to `SelectTrigger` class names so clicking the badge itself opens the dropdown with no arrow.

### Calendar date picker with quick picks
Replace `<Input type="date">` with a `Calendar` component inside the popover, plus quick-pick buttons: Today, Tomorrow, Next Week, Next Month, No Date. Selection closes the popover.

**Files**: `src/pages/TaskDetailPage.tsx`, `src/pages/ProjectDetailPage.tsx`

---

## Part 2: Department Page — Command Center

Complete rewrite of the Overview tab layout in `src/pages/DepartmentPage.tsx`.

### New Section Order

```text
┌─────────────────────────────────────────────────┐
│  Department Header (name, description, color)   │
├─────────────────────────────────────────────────┤
│  DEPARTMENT FOCUS (hero card)                   │
│  ┌───────────────┐ ┌─────────────────────────┐  │
│  │ Current       │ │ Key Objective            │  │
│  │ Priorities    │ │ (from goals or strategy) │  │
│  │ (1-2 items)   │ │                          │  │
│  └───────────────┘ │ Constraints              │  │
│                     │ (from strategy_items)    │  │
│                     └─────────────────────────┘  │
├─────────────────────────────────────────────────┤
│  KEY INITIATIVES (top 3-5 projects)             │
│  Cards with: title, status badge, owner,        │
│  priority indicator. Not a generic list.        │
├─────────────────────────────────────────────────┤
│  EXECUTION SNAPSHOT                             │
│  High-priority tasks only (urgent/high),        │
│  compact checklist, max 6 items.                │
│  Open issues count + top 3 by priority.         │
├─────────────────────────────────────────────────┤
│  RESOURCES & PLAYBOOKS                          │
│  Docs + databases as named cards with           │
│  descriptions, not "Databases (1)" labels.      │
├─────────────────────────────────────────────────┤
│  TEAM                                           │
│  Members with role context — who owns which     │
│  project. Grid of avatar cards showing owned    │
│  initiative if any.                             │
├─────────────────────────────────────────────────┤
│  RECENT ACTIVITY (compact feed)                 │
│  Query entity_activity for dept's project/task  │
│  IDs instead of empty activity_events table.    │
└─────────────────────────────────────────────────┘
```

### Data Sources for Department Focus
- **Current Priorities**: Top 1-2 goals with highest progress gap (lowest progress, non-completed) for this department
- **Key Objective**: First strategy_item of type `objective` assigned to this department with status `in_execution` or `acknowledged`
- **Constraints**: Strategy_items of type `constraint` assigned to this department

### Visual Design
- Department header uses the `color` field from the departments table as an accent bar
- Focus section uses a prominent card with subtle gradient/border accent
- All sections always render with friendly empty states ("No constraints — clear runway", "No open issues — smooth sailing")
- Section headers use icons and concise labels, no counts in parentheses

### Activity Fix
Query `entity_activity` by first collecting project IDs and task IDs for this department, then fetching activity where `entity_id` is in that set. Fall back to empty state if no activity.

### Key Initiatives
- Query projects with `department_id`, sorted by priority (urgent > high > medium > low)
- Show max 5, include `owner_id` resolved to profile name
- Fetch project owner names from profiles

### Team Enhancement
- Cross-reference members with projects table to show "Leads: Project X" under each member
- Show role from user_roles if admin/moderator

## Files

| What | File |
|------|------|
| Focus ring, chevron, date picker fixes | Edit: `src/pages/TaskDetailPage.tsx` |
| Focus ring, chevron, date picker fixes | Edit: `src/pages/ProjectDetailPage.tsx` |
| Full department page redesign | Edit: `src/pages/DepartmentPage.tsx` |

No database changes needed.

