

# TableView Polish: Remove checkbox, hollow status circle, subtle hover

## Changes to `src/components/execution/TableView.tsx`

### 1. Remove quick-complete checkbox
- Delete the `Checkbox` import and the `handleQuickComplete` function
- Remove the checkbox block (lines 155–165)

### 2. Status dot → hollow circle until done
- Change `StatusDot` so non-done statuses render as an **empty ring** (border only, no fill): `border-2 border-current` with the status color applied via `text-{color}`
- When status is `done`, render a **filled green circle** with a checkmark or solid fill to indicate completion
- Keep the click-to-change-status behavior

### 3. Hover effect → subtle background darken only
- Replace `hover:shadow-md hover:-translate-y-[1px] hover:bg-muted/50` with just `hover:bg-muted/50`
- No lift, no shadow — just a gentle background shift

## Files

| Action | File |
|--------|------|
| Edit | `src/components/execution/TableView.tsx` |

No other files affected.

