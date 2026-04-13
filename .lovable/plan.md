

# Simplify Sidebar UI

## Current State
The sidebar has 7 top-level items + 3 collapsible groups (Departments, Leadership, Databases), with departments listed twice. It feels crowded and repetitive.

## Proposed Simplified Sidebar

```text
┌─────────────────────┐
│ T  TeamSpace        │
│    Workspace        │
├─────────────────────┤
│ 🏠 Home             │
│ 📄 Docs             │
│ 🗃 Databases        │
│ 👥 People           │
│ 🎓 Training         │
│ 🧭 Strategy  (CEO)  │
├─────────────────────┤
│ ▸ Departments       │
│    Engineering      │
│    Design           │
│    Product          │
│    Marketing        │
│    Operations       │
├─────────────────────┤
│ ─── Admin ────────  │
│ ⚙ Settings          │
├─────────────────────┤
│ 👤 Sarah Chen       │
│    Admin            │
│ 🛡 Admin mode  [●]  │
└─────────────────────┘
```

### What changes:

1. **Remove "Leadership" collapsible group** from sidebar entirely
2. **Remove "Databases" collapsible group** (the individual DB list) — keep only the top-level "Databases" link
3. **Add a "Leadership" tab to each Department page** — so clicking Engineering shows tabs: Overview | Leadership | (future: Execution). The Leadership tab embeds the existing LeadershipDashboard content for that department.
4. **Move Settings into a separate "Admin" section** at the bottom of the sidebar, only visible to admins
5. **Strategy stays in main nav**, only visible to CEO/admin (current behavior)

### Result: Sidebar goes from ~15+ visible items to ~8-9, with one clean collapsible group.

## Files to Modify

| File | Change |
|------|--------|
| `src/components/AppSidebar.tsx` | Remove Leadership collapsible, remove Databases collapsible, add Admin section for Settings |
| `src/pages/DepartmentPage.tsx` | Add Tabs component with "Overview" (current content) and "Leadership" (embed LeadershipDashboard) |

## Technical Details
- DepartmentPage gets `Tabs` from shadcn with two tab values: `overview` (existing content) and `leadership` (renders `LeadershipDashboard` inline, passing the dept ID)
- LeadershipDashboard already accepts `deptId` from URL params — we'll pass it as a prop instead so it works both as a standalone page and embedded
- The `/leadership/:deptId` route stays functional for direct linking but sidebar no longer lists it

