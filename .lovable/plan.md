
The user dislikes the horizontal scrollbar under the kanban board (visible in the screenshot below the IN PROGRESS / BLOCKED / DONE columns). Let me think through alternatives.

## Current state
`KanbanBoard.tsx` likely uses fixed-width columns in a horizontal flex container with `overflow-x: auto`, producing a permanent scrollbar at the bottom.

## Options to consider

**Option 1: Auto-fit columns to viewport width**
Make columns flex/shrink so all status columns fit on screen — no horizontal scroll. Works well with 4-5 statuses. Trade-off: column min-width gets tight on small screens, cards get narrower.

**Option 2: Hidden scrollbar + drag/wheel to scroll**
Hide the scrollbar visually (`scrollbar-width: none`), enable click-drag panning and shift+wheel horizontal scroll. Trade-off: discoverability — users may not realize they can scroll.

**Option 3: Edge fade + arrow buttons**
Hidden scrollbar, gradient fade on right edge indicating more content, plus floating left/right arrow buttons that appear on hover. Trello/Linear style. Most polished.

**Option 4: Vertical stack on narrow screens, horizontal otherwise**
Responsive — stack columns below a breakpoint.

## Recommendation
Combine **1 + 3**: 
- Default: columns flex to fill available width (no scroll needed for typical 4-5 statuses)
- If overflow occurs (many statuses): hidden scrollbar + edge fade + hover arrow buttons + shift-wheel scroll
- Cards keep a sensible min-width (~260px); columns share remaining space evenly

This gives the cleanest look in the common case and graceful overflow handling.

## Files
- `src/components/execution/KanbanBoard.tsx` — flex column sizing, hidden scrollbar utility, edge fade gradients, hover scroll buttons, shift+wheel handler
- `src/index.css` — add `.scrollbar-hide` utility (if not present)

No DB changes.

---

# Plan: Cleaner Kanban Overflow

**Default behavior**: Columns auto-fit to fill the board width — no horizontal scrollbar in the typical 4–5 status case.

**When overflow is unavoidable** (many custom statuses):
- Native scrollbar hidden via CSS
- Soft gradient fade on the right (and left when scrolled) hints at more content
- Floating chevron buttons appear on hover at the edges to scroll one column at a time
- Shift + mouse wheel scrolls horizontally

**Column sizing**: `flex: 1 1 0; min-width: 260px; max-width: 320px` — columns share space evenly, cards stay readable.

**Files**
- `src/components/execution/KanbanBoard.tsx` — column flex sizing, scroll container, edge fades, hover arrow buttons, wheel handler
- `src/index.css` — `.scrollbar-hide` utility

No DB migrations.
