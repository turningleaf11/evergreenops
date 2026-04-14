

# Card-Enhanced List UI for Projects & Tasks

## Summary

Replace the current plain HTML `<Table>` rows in `TableView.tsx` (and polish `KanbanBoard.tsx` to match) with a modern card-enhanced list: colored left border per status, rounded status/priority pills, avatar circles for assignees, and status-grouped sections with collapsible headers.

## What changes

### 1. Rewrite `TableView.tsx` as a card-enhanced list

- Remove the `<Table>` markup entirely
- Render items grouped by status, each group with a collapsible header showing status label + count
- Each row becomes a flex container with:
  - **Left accent bar** (3px, colored by status)
  - **Title** (medium weight, truncated)
  - **Status pill** (colored rounded-full badge)
  - **Priority pill** (small colored badge)
  - **Avatar circle** (initials from assignee/owner name, colored background)
  - **Due date** (small muted text, right-aligned)
- Clicking a row still calls `onItemClick`
- Status is still inline-changeable via clicking the status pill (opens a small popover/select)

### 2. Polish `KanbanBoard.tsx` cards to match

- Add avatar circles instead of plain text names
- Match the same priority pill styling
- Consistent typography and spacing

### 3. Dark mode compatibility

- Use Tailwind's `dark:` variants for the status/priority pill colors so they look correct in both themes

## Files

| Action | File |
|--------|------|
| Rewrite | `src/components/execution/TableView.tsx` — Card-enhanced grouped list |
| Edit | `src/components/execution/KanbanBoard.tsx` — Avatar circles + pill consistency |

No database or routing changes needed.

