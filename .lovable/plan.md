

# Multi-Issue Fix & Feature Discussion

## 1. Fix Double Status on Goals
**Problem**: Line 535 renders a `StatusBadge` and line 536 renders a `Select` dropdown — both showing the same status side by side (visible in your screenshot).

**Fix**: Remove the `StatusBadge` on line 535. The `Select` dropdown already shows the current status and lets users change it — one element is sufficient. Style the Select trigger to match the status color so it serves as both display and control.

**File**: `src/pages/ExecutionPage.tsx` — delete line 535 (`<StatusBadge status={goal.status} />`), then style the SelectTrigger with the status color from `statusConfig`.

---

## 2. Reminders: Multi-User Delegation
**Problem**: The `reminders` table has a single `assigned_to` column. You want reminders pushed to multiple users.

**Changes**:
- **Migration**: Create a `reminder_assignees` junction table (`reminder_id UUID FK → reminders, user_id UUID FK → auth.users`). Keep `assigned_to` on reminders for backward compat or drop it.
- **RLS**: Assignees can read/complete their own reminders.
- **UI** (`RemindersWidget.tsx`): Replace the single-user delegation with a multi-select people picker (reuse the profile popover pattern from Execution Hub). When creating a reminder, allow selecting multiple team members. Each assignee sees the reminder in their bell.
- **Query**: Fetch reminders where `user_id = me` OR exists in `reminder_assignees`.

---

## 3. Mobile Optimization
**Key changes across the app**:
- **Layout.tsx**: Sidebar already uses SidebarProvider (collapsible). Verify it collapses on mobile. Add `safe-area-inset` padding.
- **Index.tsx / ExecutionPage.tsx**: Switch grid layouts to single-column on `sm:` breakpoint. Reduce `p-8` to `p-4` on mobile.
- **Cards**: Ensure text doesn't overflow — add `truncate` and `min-w-0` where needed.
- **Goal cards**: Stack status Select below title on mobile instead of inline.
- **Dialogs**: Use `Drawer` on mobile viewports instead of `Dialog` for create flows (or ensure dialogs are full-width on small screens).
- **Header**: Compact spacing, smaller icons on mobile.
- **Sidebar**: Ensure overlay mode on mobile with swipe-to-close.
- **Tables** (DataTableView, TableView): Horizontal scroll wrapper on mobile with sticky first column.

---

## 4. Intranet/Team Feature Ideas

Here are features commonly found in premium intranet/team platforms:

| Feature | Description |
|---------|-------------|
| **Company Wiki** | Structured knowledge base with nested pages, search, and version history |
| **Team Polls / Surveys** | Quick internal polls for decision-making or feedback |
| **Company Calendar** | Shared events, milestones, department schedules |
| **Employee Directory Enhancements** | Skills/expertise tags, availability status, timezone display |
| **Announcements / News Feed** | Pinned company-wide announcements with read receipts |
| **Resource Booking** | Conference rooms, equipment, shared assets |
| **Time Tracking** | Per-task or per-project time logging with reports |
| **Internal Forms / Requests** | PTO requests, IT tickets, procurement — templated workflows |
| **Team Kudos / Recognition** | Peer recognition wall, badges, shout-outs |
| **File Library** | Centralized document repository with folders and permissions |

---

## 5. Add-On Packs Architecture

This is a great SaaS monetization strategy. Here's a suggested architecture:

### Data Model
- **`addon_packs`** table: `id`, `slug` (e.g. `real-estate-research`), `name`, `description`, `icon`, `price_tier`, `is_active` (global toggle)
- **`workspace_addons`** table: `workspace_id`, `addon_id`, `enabled_at`, `enabled_by` — tracks which workspaces have activated which packs
- Each pack's actual content (tabs, pages, edge functions) lives in normal code but is **gated** behind an `useAddonEnabled(slug)` hook

### How It Works
1. Admin goes to Settings → Add-Ons
2. Sees a marketplace-style grid of available packs
3. Clicks "Enable" on a pack → row inserted into `workspace_addons`
4. The sidebar and routing conditionally render the pack's tab/pages based on `workspace_addons`
5. When you add payments later, enabling a paid pack triggers a checkout flow first

### Example Packs
- **Real Estate Market Research** — AI-powered comps, market analysis tab
- **CRM Pipeline** — GoHighLevel-style deal tracking (you already have pieces)
- **HR & Payroll** — Time-off tracking, payroll integration hooks
- **Client Portal** — External-facing project status for clients
- **Analytics Dashboard** — Charts, KPIs, custom report builder

### Implementation Priority
For now, just build the **gating infrastructure** (the two tables + hook + Settings UI). Then you can add individual packs over time without restructuring.

---

## Summary of Code Changes

| Action | File/Target |
|--------|-------------|
| Edit | `src/pages/ExecutionPage.tsx` — Remove duplicate StatusBadge on goals |
| Migration | Create `reminder_assignees` junction table |
| Edit | `src/components/RemindersWidget.tsx` — Multi-user picker for delegation |
| Edit | `src/components/Layout.tsx` — Mobile safe-area, responsive tweaks |
| Edit | `src/pages/Index.tsx` — Mobile-responsive grid/spacing |
| Edit | `src/pages/ExecutionPage.tsx` — Mobile-responsive goal cards and tables |
| Edit | Multiple page files — Add responsive breakpoint classes |
| Migration | Create `addon_packs` and `workspace_addons` tables |
| New | `src/hooks/useAddonEnabled.ts` — Hook to check if a pack is active |
| New | Add-Ons section in `src/pages/SettingsPage.tsx` — Marketplace grid |
| Edit | `src/components/AppSidebar.tsx` — Conditionally render add-on nav items |

