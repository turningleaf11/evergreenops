

# CEO Page Overhaul — Rename, 3 Tabs, Vision Portal

## Summary

Four changes: (1) Rename the page to "CEO Cockpit" (configurable in Settings), (2) let admins rename the "Departments" sidebar label, (3) collapse from 4 tabs to 3 by merging Strategy content into Command, (4) replace the Vision accordion with a small floating icon button that opens a slide-out sheet.

## 1. Configurable Page & Department Names in Settings

Add two new fields to the `workspaces` table: `ceo_page_name` (default "CEO Cockpit") and `dept_label` (default "Departments").

**Settings page** gets a new card under the Workspace tab:
- "CEO Page Title" — text input (e.g. "CEO Cockpit", "CEO Dash", "Command Center")
- "Department Group Label" — text input (e.g. "Departments", "Teams", "Spaces", "Divisions")

Both values flow through `WorkspaceContext` so the sidebar and CEO page read them reactively.

## 2. Collapse to 3 Tabs

Remove the **Strategy** tab. Move its contents into **Command**:

**Command tab** (new layout):
- CEO Briefing + Top Priorities + Morning Reset (existing 2-col grid)
- Strategy Creator (below grid)
- Leadership Review Feed
- Decision Log (collapsed accordion)

This puts all operational + strategic tools in one place.

## 3. Vision — Floating Icon Portal

Instead of the Vision accordion living inside a tab, add a small circular icon button in the top-right of the page header (next to the date/title area). The icon: **Binoculars** (lucide `Binoculars` icon) — subtle, thematic, a bit playful.

- Hover tooltip: "Vision & Long-Term Targets"
- Click opens a **Sheet** (slide-out drawer from the right) containing the full Vision accordion + Quarterly Rocks
- Always accessible from any tab, but never in the way

## 4. Migration

```sql
ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS ceo_page_name text DEFAULT 'CEO Cockpit',
  ADD COLUMN IF NOT EXISTS dept_label text DEFAULT 'Departments';
```

## Files

| Action | File |
|--------|------|
| Migrate | `workspaces` table — add `ceo_page_name`, `dept_label` columns |
| Edit | `src/contexts/WorkspaceContext.tsx` — Add `ceoPageName`, `deptLabel` to state + setters + persistence |
| Edit | `src/pages/SettingsPage.tsx` — Add "Naming" card with CEO page title and department label inputs |
| Edit | `src/pages/CeoDashboard.tsx` — Use `ceoPageName` for title, collapse to 3 tabs, move Strategy content into Command, extract Vision into a Sheet triggered by a Binoculars icon button |
| Edit | `src/components/AppSidebar.tsx` — Use `deptLabel` instead of hardcoded "Departments", use `ceoPageName` for sidebar nav label |

