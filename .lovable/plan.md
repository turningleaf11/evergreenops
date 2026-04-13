

# Execution Plan: Evergreen Real Estate Ventures Platform

## Phase 1 — Real Estate Domain Content (Mock Data Overhaul)

Replace all generic tech-company mock data with real estate acquisitions content.

**Team Members**: Replace with roles like Acquisitions Manager, Disposition Coordinator, Transaction Coordinator, Underwriter, Property Inspector, Marketing Specialist, Dispo Manager.

**Announcements**: Replace with relevant items like "New wholesale deal pipeline update", "Portfolio acquisition under LOI — 24-unit Maple Ridge".

**Docs**: Replace with real estate templates — Wholesale SOPs, Underwriting Checklist, Disposition Playbook, JV Partnership Guidelines, Due Diligence Procedures.

**Database Templates**: Add real-estate-specific templates alongside existing ones:
- **Deal Pipeline** — Property Address, Asking Price, ARV, Offer Price, Seller Contact, Deal Status (Lead / Under Contract / Closed / Dead), Acquisition Type, Disposition Strategy
- **Property Tracker** — Address, Unit Count, Square Footage, Condition, Inspection Date, Rehab Estimate
- **Disposition Board** — Property, Buyer, Assigned Price, Status, Close Date
- **Comps Database** — Address, Sale Price, Sale Date, Sq Ft, Price/Sq Ft

**Sample Databases**: Seed 2-3 databases with realistic rows (active wholesale deals, portfolio pipeline).

**Strategy Items**: Update CEO context defaults — objectives like "Close 5 wholesale deals/month", constraints like "Hard money lender cap at $2M exposure", decisions around market focus.

## Phase 2 — Real User Authentication

Replace the mocked `AuthContext` with real Lovable Cloud authentication.

- Create `profiles` table (user_id, full_name, avatar_url, department_id) with RLS
- Create `user_roles` table (user_id, role) with security-definer helper
- Build login and signup pages with email + Google OAuth
- Auto-confirm disabled (email verification required)
- Update `AuthContext` to use real auth session
- Protect admin routes (Settings) server-side via role checks

## Phase 3 — Database Persistence (Lovable Cloud)

Migrate localStorage data to Lovable Cloud tables so data persists across devices/users.

| Table | Purpose |
|-------|---------|
| `workspaces` | Name, description, logo_url |
| `departments` | Name, description, icon, color |
| `documents` | Title, content, parent_id, visibility, shared_with |
| `databases_meta` | Title, description, columns (JSONB) |
| `database_rows` | database_id, values (JSONB) |
| `announcements` | Title, content, department_id, pinned |
| `strategy_items` | Type, title, description, status, assigned_depts |
| `strategy_responses` | Item_id, department_id, type, analysis |
| `training_modules` | Title, description, type, category, steps (JSONB) |
| `decision_log` | Title, rationale, outcome, created_by |

All tables get RLS policies scoped to authenticated users, with admin-only write on workspace/departments/training.

## Phase 4 — Notifications & Activity Feed

- Create `activity_events` table (event_type, actor_id, entity_type, entity_id, metadata, created_at)
- Insert events on key actions: strategy item created, response submitted, deal status changed, decision logged
- Add a notification bell in the sidebar header with unread count
- Activity feed page or drawer showing recent events across the workspace
- Use Supabase Realtime for live updates

## Phase 5 — Department Page Enhancements (Real Estate Specific)

Since you've already customized department names, these are domain-specific upgrades to department pages:

- **Quick Stats Bar** at the top of each department: show KPI cards pulled from that department's databases (e.g., Wholesale: "12 Active Leads · 3 Under Contract · $420K pipeline value"; Portfolio: "2 LOIs Out · 47 Units Under Review")
- **Pinned Databases** section: auto-surface databases shared with the department at the top with inline row counts and status breakdowns
- **Recent Activity** section: show last 5 activity events scoped to the department
- **Department-specific doc templates**: when creating a new doc from a department page, offer templates relevant to that department (e.g., "Property Analysis Memo" for acquisitions, "Disposition Marketing Sheet" for dispo)

## Build Order

1. **Phase 1** — Mock data overhaul (no infrastructure changes, immediate visual impact)
2. **Phase 2** — Auth (foundation for multi-user)
3. **Phase 3** — Database persistence (requires auth for RLS)
4. **Phase 4** — Notifications (requires persistence layer)
5. **Phase 5** — Department enhancements (can be built incrementally)

## Files Changed

| Phase | Files |
|-------|-------|
| 1 | `mock-data.ts`, `ceo-context.ts`, `training-data.ts`, `strategy-flow.ts` |
| 2 | New: `pages/LoginPage.tsx`, `pages/SignupPage.tsx`. Edit: `AuthContext.tsx`, `App.tsx`. Migration: `profiles`, `user_roles` tables |
| 3 | New context files or hooks per table. Migrations for all tables. Edit: all pages/components that read from mock-data or localStorage |
| 4 | New: `components/ActivityFeed.tsx`, `components/NotificationBell.tsx`. Migration: `activity_events` table |
| 5 | Edit: `DepartmentPage.tsx`, new: `components/DeptQuickStats.tsx`, `components/DeptRecentActivity.tsx` |

