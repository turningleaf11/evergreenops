

# SaaS Conversion + Landing Page + UX Improvements

## Overview
Convert the app to a SaaS product with a public landing page, workspace creation on signup, and several UX enhancements. Your existing account and data will be preserved by associating them with a default workspace.

---

## Phase 1: Landing Page (8 sections, premium feel)

Create `src/pages/LandingPage.tsx` — a dark-themed, glassmorphism-styled marketing page for unauthenticated visitors:

1. **Hero** — "The Operating System for CEOs Who Actually Run Things." CTA: Get Started Free. Subtle animated gradient background.
2. **Problem Statement** — "Your team uses 5+ tools. None of them talk to each other. And none of them are built for the person steering the ship."
3. **CEO Cockpit Spotlight** — Hero feature section. Brain Dump, Command, Delegation tabs visualized. "No other tool puts the CEO at the center."
4. **Strategy Flow** — CEO → Leadership communication pipeline. Visual showing strategy cascade with acknowledge/translate flow.
5. **Execution Hub** — Goals → Projects → Tasks → Issues. Kanban/List/Table views. "Notion meets ClickUp, built for operators."
6. **Company Intranet** — Feed, Polls, Announcements, Kudos, Wiki/Docs. "Your team's digital HQ."
7. **Add-On Packs** — Time Clock, Market Research AI, and future packs. "Only pay for what you need."
8. **CTA Footer** — "Start running your company, not chasing it." Sign up button + login link.

**Routing**: Unauthenticated users hitting `/` see the landing page. Authenticated users see the dashboard (current `Index`).

---

## Phase 2: SaaS Multi-Tenancy + Workspace Creation

### Account Safety
- Your existing data stays intact. A migration will create a default workspace row and backfill `workspace_id` on existing tables.
- No data loss — the migration only adds columns with defaults.

### Database Changes
- **Migration**: Add `workspace_id` (uuid, nullable, default to the first workspace) to key tables: `profiles`, `projects`, `tasks`, `goals`, `issues`, `documents`, `databases_meta`, `announcements`, `polls`, `posts`, `kudos`, `strategy_items`, `departments`.
- **Migration**: Create a trigger on `auth.users` insert that also creates a workspace if none exists (for new signups).
- **Migration**: Backfill all existing rows with the default workspace ID.

### Signup Flow
- Update `SignupPage.tsx` to include a "Workspace Name" field.
- After signup + email verification + first login, auto-create workspace + assign user as admin of that workspace.
- The `handle_new_user` trigger will be updated to handle workspace creation.

### RLS Updates
- Add `workspace_id = current_workspace_id()` checks to RLS policies (using a helper function that reads from the user's profile or JWT).

---

## Phase 3: Docs → Wiki Hierarchy

- Rename sidebar item "Docs" → "Wiki"
- Refactor `DocsPage.tsx` to show a sidebar tree using existing `parent_id` column
- Add breadcrumb navigation (Home > Parent Doc > Current Doc)
- Collapsible nested page tree in left panel, content area on right
- Keep all existing doc features (tags, visibility, rich text editing)

---

## Phase 4: Time Clock Enhancements

### Clock-In Status Indicator
- Add a persistent mini-banner/pill on `Index.tsx` (Home page): green "Clocked In — 3h 22m" or amber "Don't forget to clock in"
- Only shown for users with `time_clock_enabled = true`

### Quick Clock-In Widget
- Add a one-tap clock in/out button widget on the Home page
- Shows elapsed time when clocked in

### Per-User Time Clock Toggle
- **Migration**: Add `time_clock_enabled` boolean to `profiles` (default false)
- In Settings → Users & Roles, add a toggle per user to enable/disable time clock access
- Time Clock sidebar item only shows for users with this flag enabled (or admins)

---

## Phase 5: Department Resources Organization

- Refactor the Resources & Playbooks tab on `DepartmentPage.tsx`
- Group items into collapsible categories: "Documents", "Lists", "Pinboard"
- Each category shows its items as a clean list with icons
- Add ability to pin/star important items to the top
- Sort within categories by name or date

---

## Phase 6: Form Submissions → Execution Hub

- Move form review queue from `SettingsPage.tsx` to a new "Submissions" tab in `ExecutionPage.tsx`
- Admin can review pending submissions, approve/reject with notes
- Keep form template management in Settings
- Keep user-facing form access on Home page

---

## Technical Details

| Action | File |
|--------|------|
| New | `src/pages/LandingPage.tsx` — 8-section marketing page |
| Edit | `src/App.tsx` — Conditional routing: landing vs dashboard |
| Edit | `src/pages/SignupPage.tsx` — Add workspace name field |
| Edit | `src/pages/DocsPage.tsx` — Wiki tree sidebar + breadcrumbs |
| Edit | `src/pages/Index.tsx` — Time clock widget, keep forms section |
| Edit | `src/pages/TimeClockPage.tsx` — Respect `time_clock_enabled` |
| Edit | `src/pages/DepartmentPage.tsx` — Categorized resources |
| Edit | `src/pages/ExecutionPage.tsx` — Add Submissions tab |
| Edit | `src/pages/SettingsPage.tsx` — Remove submissions review, add time clock toggle per user |
| Edit | `src/components/AppSidebar.tsx` — Rename Docs→Wiki, conditional Time Clock |
| Migration | Add `workspace_id` to tables, backfill, create workspace helper function |
| Migration | Add `time_clock_enabled` to `profiles` |
| Memory | Update navigation, feature memories |

