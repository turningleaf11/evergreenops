

# Docs Tags, Issues in Execution Hub, Vision in Strategy

## Summary
Three changes: (1) Replace comma-separated tag input in Docs with a chip-based UI and add a tag filter bar, (2) Move Issues into Execution Hub as a 4th tab, (3) Move Vision into the Strategy/CEO page and remove both from the sidebar.

---

## 1. Docs — Chip-Based Tags + Filter Bar

**DocsPage.tsx** changes:
- Add a **tag filter bar** above the document list in the sidebar panel — render all unique tags from loaded docs as clickable pill/chip buttons; clicking one filters the list; clicking again deselects
- Support multi-tag filtering (AND logic — show docs matching all selected tags)
- **InlineDocEditor tag editing**: Replace the comma-separated text input with a chip input — show each tag as a removable pill (`Badge` with an X button), plus a small inline input to type and press Enter to add new tags
- Remove the comma text field entirely

**Files**: `src/pages/DocsPage.tsx`

---

## 2. Issues → 4th Tab in Execution Hub

**ExecutionPage.tsx** changes:
- Add a 4th tab: `Issues` after `My Tasks`
- Move all IDS logic (issue CRUD, IDS detail dialog, solve-with-task/project, dismiss) from `IssuesPage.tsx` into `ExecutionPage.tsx`
- The Issues tab will show Open/Resolved sub-tabs (same as current) with the IDS detail dialog
- Fetch issues + profiles in the existing `fetchAll` call
- The `solveWithTask` and `solveWithProject` functions already create tasks/projects and will integrate naturally since Execution Hub already manages those entities

**Sidebar (`AppSidebar.tsx`)** changes:
- Remove the standalone "Issues" nav item from `mainNav`

**Routing (`App.tsx`)** changes:
- Remove the `/issues` route (or redirect to `/execution`)
- Delete or keep `IssuesPage.tsx` as a redirect

---

## 3. Vision → Inside Strategy (CEO Dashboard)

**CeoDashboard.tsx** changes:
- Add a collapsible "Vision" section (or a secondary tab) that renders the Vision content (core values, core focus, 10-year target, 3-year picture, 1-year plan, quarterly rocks)
- Move the Vision rendering logic from `VisionPage.tsx` inline into the CEO dashboard
- Keep it admin/CEO-only (already gated by the Strategy nav item)

**Sidebar (`AppSidebar.tsx`)** changes:
- Remove the "Vision" item from the Admin section

**Routing (`App.tsx`)** changes:
- Remove the `/vision` route (or redirect to `/ceo`)

---

## Files Changed

| What | File |
|------|------|
| Chip tags + filter bar | `src/pages/DocsPage.tsx` |
| Issues tab in Execution | `src/pages/ExecutionPage.tsx` |
| Vision in Strategy | `src/pages/CeoDashboard.tsx` |
| Sidebar cleanup | `src/components/AppSidebar.tsx` |
| Route cleanup | `src/App.tsx` |

## No Database Changes
All existing tables and schemas stay the same. This is purely a UI reorganization.

