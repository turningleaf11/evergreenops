

# Unified Company Feed + Add-On Fix + Rich Announcements

## Problem Summary
1. **Add-on pages not appearing in sidebar** — `useAddonEnabled` hook uses `as any` casts unnecessarily (tables are in types now). Removing casts and adding debug logging will fix silent failures.
2. **Announcements, Polls, Kudos feel disconnected** — user wants them merged into a single social-style feed.
3. **Announcements need richer features** — types/banners, reactions, replies.

## Plan

### 1. Fix Add-On Sidebar Visibility
- Remove all `as any` casts from `useAddonEnabled.ts` since `addon_packs` and `workspace_addons` are now in the Supabase types
- This should fix the silent query failures preventing sidebar items from appearing

### 2. Unified "Company Feed" Page
Replace the 3 separate pages (Announcements, Polls, Kudos) with a single `/feed` page called "Company Feed" (or "Team Feed").

**Layout**: Single chronological stream mixing all post types:
- **Announcements** (admin-only creation) — with type/color banners
- **Polls** (admin-only creation) — inline voting
- **Kudos** (anyone can post) — recognition cards
- **General posts** (future: anyone can post updates)

Each card type has a distinct visual treatment but lives in one scrollable feed, sorted by `created_at`.

### 3. Rich Announcements
- **Migration**: Add columns to `announcements`:
  - `type` (text, default 'general') — values: general, urgent, celebration, update, policy
  - `banner_color` (text, nullable) — optional hex override
- **Migration**: Create `post_reactions` table (entity_type, entity_id, user_id, emoji)
- **Migration**: Create `post_replies` table (entity_type, entity_id, user_id, content, created_at)
- Each announcement type gets a preset banner/accent color (red for urgent, green for celebration, blue for update, etc.)
- Emoji reactions bar under every feed item (announcements, kudos, polls)
- Threaded replies under every feed item

### 4. UI Components
- **New**: `src/pages/CompanyFeedPage.tsx` — unified feed page
- **New**: `src/components/feed/FeedCard.tsx` — polymorphic card renderer
- **New**: `src/components/feed/AnnouncementCard.tsx` — rich announcement with type banner, reactions, replies
- **New**: `src/components/feed/PollCard.tsx` — inline poll voting
- **New**: `src/components/feed/KudosCard.tsx` — recognition card
- **New**: `src/components/feed/ReactionBar.tsx` — emoji reactions
- **New**: `src/components/feed/ReplyThread.tsx` — threaded replies
- **Edit**: `src/components/AppSidebar.tsx` — replace Announcements/Polls/Kudos with single "Feed" item; keep Forms separate
- **Edit**: `src/App.tsx` — replace 3 routes with `/feed`

### 5. Permissions
- Announcements: admin-only create (already enforced by RLS)
- Polls: admin-only create (already enforced by RLS)
- Kudos: any authenticated user can post
- Reactions/Replies: any authenticated user
- Forms stays as its own separate page

### 6. Sidebar Restructure
- Remove "Intranet" collapsible group
- Add "Feed" as a top-level nav item (with Megaphone icon)
- Keep "Forms" as a separate nav item
- Add-ons section stays as-is (but will now actually show after the fix)

## Files Summary

| Action | Target |
|--------|--------|
| Edit | `src/hooks/useAddonEnabled.ts` — Remove `as any` casts |
| Migration | Add `type`, `banner_color` to `announcements` |
| Migration | Create `post_reactions` table |
| Migration | Create `post_replies` table |
| New | `src/pages/CompanyFeedPage.tsx` |
| New | `src/components/feed/FeedCard.tsx` |
| New | `src/components/feed/AnnouncementCard.tsx` |
| New | `src/components/feed/PollCard.tsx` |
| New | `src/components/feed/KudosCard.tsx` |
| New | `src/components/feed/ReactionBar.tsx` |
| New | `src/components/feed/ReplyThread.tsx` |
| Edit | `src/components/AppSidebar.tsx` — Unified Feed nav |
| Edit | `src/App.tsx` — Replace 3 routes with `/feed` |
| Delete | `src/pages/AnnouncementsPage.tsx`, `src/pages/PollsPage.tsx`, `src/pages/KudosPage.tsx` |

