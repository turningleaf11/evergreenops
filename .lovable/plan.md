

# Sidebar Active/Hover Style — Icon Accent Only

## Changes

### 1. Remove left bar indicator (`src/index.css`)
Delete the `.nav-active-indicator` and `.nav-active-indicator::before` CSS rules entirely.

### 2. Update nav item classes (`src/components/AppSidebar.tsx`)
- **Active state**: Remove `bg-sidebar-accent` background and `nav-active-indicator` class. Replace with `text-primary font-medium` only — the icon inherits accent color, text gets bolder, no background.
- **Hover state**: Change from `hover:bg-sidebar-accent` to `hover:text-foreground` — just a subtle text color shift, no background fill.
- Apply same changes to department nav items.

### 3. Result
- Active item: icon turns accent color, text slightly bolder — nothing else
- Hover: text lightens slightly — no background rectangle
- Clean, minimal, no visual noise

## Files

| File | Change |
|------|--------|
| `src/index.css` | Remove `.nav-active-indicator` CSS |
| `src/components/AppSidebar.tsx` | Update activeClassName and hover classes |

