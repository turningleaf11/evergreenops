

# Timer Styling, Task Peek, Global Search, Remove Buttons

## 1. Reduce Timer Badge Prominence

**File**: `src/components/TimeClockButton.tsx`
- Remove `animate-pulse` (too fast/aggressive). Replace with a custom subtle glow using a CSS animation or a static `shadow-[0_0_8px_rgba(var(--primary-rgb),0.15)]` soft outer glow
- Remove `ring-2 ring-primary/20` when not clocked in — replace with a much softer `ring-1 ring-primary/10` or just the shadow glow
- When clocked in: keep `ring-1 ring-green-500/20` (subtle, not dominant)
- The elapsed time badge: reduce from `text-[9px]` to `text-[8px]`, use `bg-green-500/80` instead of full `bg-green-500`
- Add a custom CSS keyframe in `src/index.css` for a slow, subtle glow pulse (~3s duration, very low opacity change)

## 2. Task Peek from Home Page

**File**: `src/pages/Index.tsx`
- Import `DetailDrawer` component (already used in ExecutionPage and DepartmentPage)
- Add state: `drawerTask` and `drawerOpen`
- In the `my_tasks` widget, change the task `onClick` from `navigate('/tasks/${task.id}')` to opening the `DetailDrawer` with the selected task
- Need to fetch full task data on click (or pre-fetch enough fields) and pass `getName` function using the existing `profiles` state
- Add `<DetailDrawer>` at the bottom of the component, same pattern as ExecutionPage

## 3. Global Search — Functional

**File**: `src/components/Layout.tsx`
- Replace the plain `<input>` with a search component that has real functionality
- Create a new `GlobalSearch` component or inline the logic

**New file**: `src/components/GlobalSearch.tsx`
- Controlled input with debounced search (300ms)
- On typing, query multiple tables in parallel (respecting user permissions):
  - `tasks` (title ilike)
  - `projects` (title ilike)
  - `documents` (title ilike)
  - `profiles` (full_name ilike)
  - `announcements` (title ilike)
- Results shown in a dropdown/popover below the search bar, grouped by type
- Each result is a clickable link navigating to the relevant page
- Show max ~5 results per category
- Close on click or Escape
- RLS handles permission filtering automatically

## 4. Remove New Task & Post Update Buttons from Home

**File**: `src/pages/Index.tsx`
- Remove the "New Task" and "Post Update" buttons from the header action area (lines 574-579)
- Keep only the "Customize" button
- Remove the task dialog and post dialog state/JSX (lines 106-117, 264-298, 663-743) since these actions are available in the global header's `GlobalCreateMenu`
- Clean up unused imports

---

## Technical Summary

| Action | File |
|--------|------|
| Edit | `src/components/TimeClockButton.tsx` — Subtle glow, remove pulse, reduce badge |
| Edit | `src/index.css` — Add slow glow keyframe animation |
| New | `src/components/GlobalSearch.tsx` — Functional search across tables |
| Edit | `src/components/Layout.tsx` — Use GlobalSearch component |
| Edit | `src/pages/Index.tsx` — Add DetailDrawer for tasks, remove New Task/Post buttons and dialogs |

No database changes. No new dependencies.

