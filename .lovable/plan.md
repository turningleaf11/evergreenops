

# Customizable Home Page Widgets + Rich Feed Preview

## Overview
Transform the home page into a fully customizable "launchpad" with drag-and-drop widget arrangement, user preferences, and admin-controlled defaults. Upgrade the feed preview from basic text to a polished card carousel.

---

## 1. Widget Configuration System

**Database Migration**: Create `widget_preferences` table:
- `id` (uuid, PK), `user_id` (uuid), `widget_id` (text), `visible` (boolean, default true), `sort_order` (int), `column` (int, 0 or 1), `created_at`
- RLS: users CRUD their own rows

**Database Migration**: Create `widget_defaults` table (admin-managed):
- `id` (uuid, PK), `widget_id` (text, unique), `visible` (boolean, default true), `sort_order` (int), `column` (int)
- RLS: all authenticated can read, only admins can write (via `has_role` or profile role check)

**Widget registry** (constant in code):
```
time_clock, announcements, departments, forms,
my_tasks, quick_links, feed_preview, reminders,
recent_docs, activity_feed
```

**Logic**: On load, check if user has `widget_preferences` rows. If not, fall back to `widget_defaults`. If no defaults, use hardcoded order. Users can toggle widgets on/off and reorder via drag-and-drop.

---

## 2. Drag-and-Drop Arrangement

Use `@dnd-kit/core` + `@dnd-kit/sortable` for reordering widgets within a single-column sortable list (simpler than 2-column grid DnD, more reliable). Each widget becomes a draggable card with a subtle grip handle visible on hover.

A small "Customize" button (gear icon) in the page header opens a panel/sheet where users can:
- Toggle widgets on/off with switches
- Reorder via drag handles
- "Reset to defaults" button

Changes auto-save to `widget_preferences`.

---

## 3. Admin Default Configuration

In Settings page, add a "Home Page Widgets" section (admin only):
- Same toggle + reorder UI as the user customization panel
- Saves to `widget_defaults` table
- New users (no preferences yet) inherit these defaults

---

## 4. Rich Feed Preview — Card Carousel

Replace the basic text list with a horizontal scrollable card strip:
- Each card: author avatar, name, timestamp, first ~120 chars of content, image/GIF thumbnail if present
- Cards are ~280px wide, scroll horizontally with snap points
- Subtle left/right arrow buttons for navigation
- Click any card → navigates to `/feed`
- Fetch more fields: `image_url`, `gif_url`, `type` to show richer previews
- "View all →" link persists above the carousel

---

## 5. Time Clock Fix

The current code already renders a card widget (not a banner). Will verify it renders correctly and ensure the `OnboardingBanner` component (which may be what you're seeing) is not confused with the time clock. Will also confirm `time_clock_enabled` is `true` on your profile.

---

## Technical Details

| Action | Detail |
|--------|--------|
| Install | `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` |
| Migration | Create `widget_preferences` + `widget_defaults` tables with RLS |
| New | `src/components/home/WidgetCustomizer.tsx` — toggle/reorder sheet |
| New | `src/components/home/FeedCarousel.tsx` — horizontal card carousel |
| Refactor | `src/pages/Index.tsx` — Extract each section into named widget components, render dynamically based on preferences |
| Edit | `src/pages/SettingsPage.tsx` — Add admin widget defaults section |

