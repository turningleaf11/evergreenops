

# Home Page Intranet Redesign + Time Clock to Header

## Overview
Three changes: (1) Move Time Clock from home widget to global header as a play button, (2) fix task navigation, (3) redesign home as a 2-column company intranet with drag-and-drop across columns.

---

## 1. Time Clock → Global Header Button

**File**: `src/components/Layout.tsx`
- Add a new `TimeClockButton` component next to GlobalCreateMenu, RemindersBell, NotificationBell
- Small play/stop icon button with a subtle animated glow ring (`animate-pulse ring-2 ring-primary/20`) when not clocked in to draw attention
- When clocked in: shows elapsed time badge and switches to a stop icon
- Clicking opens a tiny popover or directly toggles clock in/out
- Uses same `time_entries` + `profiles.time_clock_enabled` logic from current Index.tsx
- Only renders if `time_clock_enabled` is true

**File**: `src/components/home/widgetRegistry.ts`
- Remove `time_clock` from the registry (no longer a home widget)

**File**: `src/pages/Index.tsx`
- Remove the `time_clock` case from `renderWidget` and all time clock state/logic

---

## 2. Fix Task Navigation

**File**: `src/pages/Index.tsx`
- The current `navigate('/execution/task/${task.id}')` path may not match routing. Check App.tsx routes and fix the path to match the actual task detail route.

---

## 3. Home Page → 2-Column Intranet Layout

**File**: `src/components/home/widgetRegistry.ts`
- Add a `column` field to `WidgetConfig`: `"left" | "right"`
- Update registry with default column assignments:
  - **Left (My Day)**: `my_tasks`, `reminders`, `recent_docs`
  - **Right (Company)**: `feed_preview`, `quick_links`, `announcements`, `departments`, `forms`, `activity_feed`
- Remove `time_clock` from registry

**File**: `src/hooks/useWidgetPreferences.ts`
- Add `column` field to preference loading/saving logic
- Widget preferences table already has a `column` int field — map 0=left, 1=right

**File**: `src/pages/Index.tsx` — Major refactor:

**Header section**:
- Left: Welcome message + current date (formatted nicely)
- Right: Quick action buttons (New Task, Post Update, Create Project) as small outlined buttons + Customize button

**2-Column grid**:
```
Left (7/12 or ~60%)          Right (5/12 or ~40%)
┌──────────────────┐         ┌──────────────────┐
│ My Tasks (PRIMARY)│         │ Feed Carousel     │
│ Big, dominant     │         │ Prominent, alive  │
├──────────────────┤         ├──────────────────┤
│ Reminders         │         │ Quick Links       │
├──────────────────┤         ├──────────────────┤
│ Recent Docs       │         │ Announcements     │
└──────────────────┘         ├──────────────────┤
                              │ Departments       │
                              └──────────────────┘
```

- Use two `SortableContext` zones (one per column)
- Enable drag between columns using `DndContext` with custom collision detection
- On mobile (`< md`), stack left column first then right column in single column
- My Tasks widget gets enhanced styling: larger card, prominent header, today/overdue grouping

**File**: `src/components/home/WidgetCustomizer.tsx`
- Add column toggle (Left/Right) per widget in the customizer sheet
- Show widgets grouped by column

---

## 4. Feed Preview Enhancement

**File**: `src/components/home/FeedCarousel.tsx`
- Keep the horizontal carousel but make cards slightly taller with more content preview (~150 chars)
- Show reaction count and reply count on each card
- Fetch `type` field to show post type badge (Post, Announcement, Kudos)

---

## Technical Summary

| Action | File |
|--------|------|
| New | `src/components/TimeClockButton.tsx` — Header clock in/out button with glow |
| Edit | `src/components/Layout.tsx` — Add TimeClockButton to header |
| Edit | `src/components/home/widgetRegistry.ts` — Remove time_clock, add column field |
| Edit | `src/hooks/useWidgetPreferences.ts` — Support column field |
| Edit | `src/pages/Index.tsx` — 2-column intranet layout, quick actions, remove time clock |
| Edit | `src/components/home/WidgetCustomizer.tsx` — Column toggle |
| Edit | `src/components/home/FeedCarousel.tsx` — Richer cards |

No database changes needed — `widget_preferences` already has a `column` int field.

