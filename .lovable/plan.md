
# Team Home Space — Notion-Inspired Workspace

## Overview
A multi-department team portal with rich documentation, flexible databases (table/kanban/list views), and role-based access. Think Notion meets an internal company hub.

## Pages & Navigation

### Collapsible Sidebar
- Workspace name & logo at top
- **Home** — dashboard with recent activity, announcements, pinned pages
- **Departments** — expandable list (Engineering, Design, Marketing, etc.) each with their own space
- **Docs** — team wiki/knowledge base
- **Databases** — goals, projects, tasks
- **People** — team directory
- User avatar & settings at bottom

### 1. Home / Dashboard
- Welcome banner with team announcements
- "Recently visited" pages
- Pinned/favorited items
- Quick-access cards to each department

### 2. Department Spaces
- Each department gets its own landing page with:
  - Department description & team members
  - Pinned docs and databases
  - Department-specific announcements
- Departments: configurable list (e.g., Engineering, Design, Product, Marketing, Operations)

### 3. Documentation / Wiki
- **Rich text editor** with headings, lists, code blocks, callouts, dividers, and inline images
- Nested page hierarchy (pages within pages)
- Breadcrumb navigation
- Full-text search across docs
- Page metadata: author, created/updated dates, tags

### 4. Databases (Goals, Projects, Tasks)
- **Three switchable views** on the same dataset:
  - **Table view** — sortable, filterable columns (status, priority, assignee, due date, tags)
  - **Kanban board** — drag-and-drop cards grouped by status or any column
  - **List view** — compact checklist-style
- Database types:
  - **Goals** — OKR-style with progress tracking
  - **Projects** — linked to goals, with status and timeline
  - **Tasks** — linked to projects, assignable to team members
- Inline editing, filters, and grouping
- Color-coded status badges and priority indicators

### 5. People / Team Directory
- Grid of team member cards with avatar, name, role, department
- Filter by department
- Click to view profile with contact info and assigned tasks

## Data & Auth (Lovable Cloud + Supabase)
- **Authentication**: Email/password login with department-based role access
- **Roles**: Admin, Department Lead, Member (stored in separate `user_roles` table)
- **Database tables**: departments, pages (docs), databases, database_items, team_members, announcements
- **RLS policies**: Members see their department's content; admins see everything

## Design & UX
- Clean, minimal aesthetic — light neutral tones with subtle borders
- Notion-inspired typography and spacing
- Responsive layout (works on desktop and tablet)
- Smooth transitions between views
- Collapsible sidebar with icon-only mini mode

## Build Order
1. Sidebar navigation + routing for all pages
2. Home dashboard with static department cards
3. Department spaces with team listing
4. Rich text document editor + page hierarchy
5. Database engine with table, kanban, and list views
6. People directory
7. Auth, roles, and RLS policies
8. Search and filtering across docs and databases
