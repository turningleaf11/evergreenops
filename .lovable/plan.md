

# Top Navigation Bar + Feed Icon & Comment Fixes

## Overview
Four changes: (1) Convert header into a full-width top nav bar with workspace name, search, and icons, (2) move Pizza icon to sidebar Feed tab only, (3) fix comment layout issues, (4) restore consistent emoji trigger icon.

---

## 1. Full-Width Top Navigation Bar

**File**: `src/components/Layout.tsx`
- Increase header height from `h-14` to `h-[60px]`
- Make sticky: `sticky top-0 z-30`
- Structure into three zones:
  - **Left**: `SidebarTrigger` + workspace name (from `useWorkspace()`) + optional logo
  - **Center**: Global search input — `rounded-full bg-muted/50 border-0 placeholder:text-muted-foreground/50` with `Search` icon, width ~320px, `max-w-md`
  - **Right**: Existing icons (TimeClockButton, GlobalCreateMenu, RemindersBell, NotificationBell)
- Background: `bg-card/90 backdrop-blur-md` with `border-b border-border/20` or `shadow-sm` (light, not heavy)
- All elements vertically centered

**Search behavior (phase 1)**: The search bar is visual/structural only for now — clicking focuses it, but no search logic yet. Just the UI element.

## 2. Pizza Icon → Sidebar Feed Tab Only

**File**: `src/components/AppSidebar.tsx`
- Change the Feed nav item icon from `Megaphone` to a Lucide icon that looks like the others. Since Lucide doesn't have a true "Pizza" icon that matches their stroke style, use `Megaphone` or another clean Lucide icon. The user wants consistency — the Pizza icon from Lucide looks out of place because its style differs.
- Actually, the user specifically said "For feed emoji, use a pizza icon" — but also said icons must be consistent stroke width. The Lucide `Pizza` icon does exist and uses the same stroke system. Change the Feed sidebar icon to `Pizza`.

**File**: `src/components/feed/ReactionBar.tsx`
- Revert the emoji trigger icon from `Pizza` back to `SmilePlus` (standard emoji picker trigger)
- Import `SmilePlus` from lucide-react, remove `Pizza` import

## 3. Fix Comment/Reply Layout

**File**: `src/components/feed/PostCard.tsx`
- The action row currently has `ReplyThread` as a flex sibling which causes it to expand weirdly. The `ReplyThread` component contains the full expanded reply section inside it.
- Fix: Keep the toggle button inline, but move the expanded reply content below the action row.
- Split approach: `ReplyThread` renders the toggle button inline AND the expanded content below via a portal/fragment pattern, OR restructure PostCard to:
  1. Action row: `ReactionBar` (left) + reply toggle button (right) — just the button, not the thread
  2. Below action row: expanded reply thread content

**File**: `src/components/feed/ReplyThread.tsx`
- Accept a `renderToggleOnly` vs full render pattern, OR refactor so the component can be split
- Simpler approach: keep ReplyThread as-is but ensure the expanded section uses `w-full` and breaks out of the flex row properly. Wrap the whole ReplyThread in a container that allows the toggle to be inline but the expanded content to be full-width below.

Actually the cleanest fix: In PostCard, separate the action row from the thread content:
- Action row: `flex items-center` with ReactionBar + a simple reply count/toggle button
- Below: `ReplyThread` component (full width, only renders when expanded)
- Pass `expanded`/`setExpanded` as props to control from PostCard level

## 4. Icon Consistency Audit

**Files**: `ReactionBar.tsx`, `PostCard.tsx`, `ReplyThread.tsx`
- All icons: `h-4 w-4` or `h-3.5 w-3.5` for small contexts
- Apply `text-muted-foreground/70` to decorative/secondary icons
- Ensure consistent Lucide imports (no mixed icon sets)

---

## Technical Summary

| Action | File |
|--------|------|
| Edit | `src/components/Layout.tsx` — Full-width top nav with 3 zones, sticky, search bar |
| Edit | `src/components/AppSidebar.tsx` — Feed icon → `Pizza` |
| Edit | `src/components/feed/ReactionBar.tsx` — Revert to `SmilePlus` trigger |
| Edit | `src/components/feed/PostCard.tsx` — Separate action row from expanded reply thread |
| Edit | `src/components/feed/ReplyThread.tsx` — Support split rendering (toggle vs content) |

No database changes. No new dependencies.

