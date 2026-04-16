

# Feed Compacting, Edit/Delete, Popups, and Announcements

## Overview
Compact post whitespace, add edit/delete for posts, use dialog popups for home quick actions, replace carousel with vertical mini-feed, wire announcements with acknowledgments, and swap emoji trigger icon to Pizza.

---

## 1. Compact PostCard Layout

**File**: `src/components/feed/PostCard.tsx`
- Merge ReactionBar and ReplyThread toggle onto one line: `flex items-center gap-2` row with reactions on left, reply toggle on right
- Reduce `space-y-3` to `space-y-2`, reduce padding from `p-4` to `p-3`
- Content text stays full, but the action row (reactions + comments toggle) is a single compact line

**File**: `src/components/feed/ReplyThread.tsx`
- Keep collapsed preview but tighten spacing

## 2. Edit/Delete Posts

**File**: `src/components/feed/PostCard.tsx`
- Add a `MoreHorizontal` dropdown (top-right of post, visible on hover or for author/admin)
- Options: Edit, Delete
- Edit: inline textarea replacing content, save/cancel buttons
- Delete: confirmation then `supabase.from("posts").delete()`
- Pass `onUpdate` callback prop to refresh feed after edit/delete

**File**: `src/pages/CompanyFeedPage.tsx`
- Pass `onRefresh={fetchFeed}` to each PostCard via FeedCard

**File**: `src/components/feed/FeedCard.tsx`
- Thread `onRefresh` prop through to PostCard

## 3. Home Quick Action Popups

**File**: `src/pages/Index.tsx`
- "New Task" button: instead of `navigate("/execution")`, open a dialog using the same task creation form from `GlobalCreateMenu` (title, priority, assignee, due date, description toggle)
- "Post Update" button: open a dialog containing `FeedComposer` component
- Extract the task creation dialog logic from `GlobalCreateMenu` into a shared hook or just replicate the same dialog pattern inline in Index.tsx

## 4. Home Feed — Vertical Mini-Feed (replace carousel)

**File**: `src/components/home/FeedCarousel.tsx` → Rename/refactor to `FeedPreview.tsx`
- Show 3 most recent posts as compact vertical `PostCard`-style cards (not the full PostCard, but similar compact layout: avatar, name, timestamp, content preview ~150 chars, media thumbnail, reaction/reply counts)
- No horizontal scrolling
- "View all →" link to `/feed`

**File**: `src/pages/Index.tsx`
- Update import from FeedCarousel to FeedPreview

## 5. Announcements Widget — Filter from Feed

**File**: `src/pages/Index.tsx` (announcements widget)
- Fetch from `announcements` table (already done), but also show recent non-pinned announcements
- Remove the `eq("pinned", true)` filter, show latest 3 announcements

**Migration**: Create `announcement_acknowledgments` table:
- `id` (uuid PK), `announcement_id` (uuid FK → announcements), `user_id` (uuid FK → auth.users), `acknowledged_at` (timestamptz default now()), unique(announcement_id, user_id)
- RLS: authenticated users can insert/select their own rows

**File**: `src/pages/Index.tsx` (announcements widget)
- For each announcement, show a small "✓ Seen" button that inserts an acknowledgment
- Show count: "3/5 seen" badge
- Auto-acknowledge: when announcement is rendered/visible, auto-insert acknowledgment after 3 seconds (intersection observer or simple timeout)

## 6. Icon Standardization — Pizza Emoji Trigger

**File**: `src/components/feed/ReactionBar.tsx`
- Replace `SmilePlus` import with `Pizza` from lucide-react
- Apply `text-muted-foreground/70` opacity to the trigger icon

## 7. Global Icon Audit

**Files**: PostCard, ReactionBar, ReplyThread, Index.tsx
- Ensure all icons use `h-4 w-4` (or `h-3.5 w-3.5` for inline/small contexts)
- Apply `text-muted-foreground/70` to decorative icons

---

## Technical Summary

| Action | File |
|--------|------|
| Edit | `src/components/feed/PostCard.tsx` — Compact layout, edit/delete dropdown |
| Edit | `src/components/feed/ReactionBar.tsx` — Pizza icon |
| Edit | `src/components/feed/FeedCard.tsx` — Thread onRefresh prop |
| Edit | `src/pages/CompanyFeedPage.tsx` — Pass onRefresh |
| Rename | `src/components/home/FeedCarousel.tsx` → `FeedPreview.tsx` — Vertical 3-post list |
| Edit | `src/pages/Index.tsx` — Dialog popups for New Task/Post, update feed import, announcements with ack |
| Migration | Create `announcement_acknowledgments` table with RLS |

