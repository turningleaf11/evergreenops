## Problem

In the database table view, the only way to open a row's full record is the small expand (`Maximize2`) button rendered in the **last** action column on the far right. On wide tables (like the Deal Pipeline shown in the screenshot), users have to scroll horizontally just to open a record. The hover state already shows a subtle indicator on the primary column, so users expect to click there.

## Goal

Make "open record" reachable from the **frozen left side** of every row, right next to the title — no horizontal scrolling required. Keep the existing right-side affordance removed (or repurposed) to avoid duplicate buttons.

## Changes

**File: `src/components/DatabaseView.tsx`** (table row renderer, ~lines 330–360)

1. In the `title` cell branch of `renderRows`, wrap the `InlineText` in a flex container and add a small `Maximize2` open button that:
   - Sits to the **right of the title text** inside the same cell.
   - Is hidden by default and revealed on row hover (`opacity-0 group-hover:opacity-100`), matching the existing pattern.
   - Calls `onEdit?.(row)` with `e.stopPropagation()` so it doesn't interfere with inline title editing.
   - Uses `title="Open record"` and the same `h-3.5 w-3.5` icon sizing for visual consistency.
   - Only renders when `onEdit` is provided.

2. Remove the duplicate `Maximize2` open button from the trailing right-side action column (~line 351–358). Keep the `MoreHorizontal` (delete) dropdown there since it's a destructive secondary action.

3. If removing the open button leaves the right-side action column with only the delete menu, keep the column structure intact (no grid template changes needed) so column widths and the "+" add-column header remain aligned.

## Technical notes

- The title cell currently renders only `<InlineText … />`. `InlineText` enters edit mode on click, so the new button must `stopPropagation` and live as a sibling inside a `flex items-center gap-1 min-w-0` wrapper, with `InlineText` getting `flex-1 min-w-0` to preserve truncation.
- No changes needed to `gridTemplate`, `autoTitleWidth`, or column ordering — the button lives inside the existing title cell.
- Kanban and list views already open records on card click, so no change needed there.

## Out of scope

- No styling overhaul of the table.
- No change to peek/drawer behavior — clicking the button still calls the existing `onEdit` handler.
