

# Department Page: Tab Restructuring

## Change

Reorganize `DepartmentPage.tsx` tabs from current **Overview | Leadership** to **Overview | Leadership | Team | Activity**.

### Tab contents

| Tab | Sections |
|-----|----------|
| **Overview** | Department Focus hero, Key Initiatives, Execution Snapshot, Resources & Playbooks, Pinboard |
| **Leadership** | Existing leadership content |
| **Team** | Team grid (moved from overview), with project ownership and role badges |
| **Activity** | ActivityFeed (moved from overview) |

### What moves
- Team member grid → new "Team" tab
- Recent Activity section → new "Activity" tab
- Everything else stays on Overview (including Pinboard)

### File
| What | File |
|------|------|
| Add Team & Activity tabs, move sections | Edit: `src/pages/DepartmentPage.tsx` |

No database changes needed.

