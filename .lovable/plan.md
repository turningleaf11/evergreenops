

# Home Page Widgets + Feed Enhancements + Giphy Fix

## Overview
Add three new home page widgets (My Tasks, Quick Links, Feed Preview), fix Giphy search by switching to Tenor API, and enhance replies with collapsing, reactions, GIFs, and voice recording.

---

## 1. Fix GIF Search — Switch to Tenor API

The Giphy public beta key is deprecated. Replace with Tenor's free API (no key required for limited use, or use Google's default Tenor key `AIzaSyAkxEIFw...` which is publicly documented).

**File**: `src/components/feed/GiphyPicker.tsx`
- Replace Giphy API calls with Tenor v2 endpoints (`https://tenor.googleapis.com/v2/search` and `/featured`)
- Use the publicly available Tenor API key
- Update response mapping (Tenor uses `results[].media_formats.tinygif.url` and `results[].media_formats.gif.url`)
- Rename component display text to "Powered by Tenor"

---

## 2. Collapsible Replies + Reactions + GIFs + Voice on Replies

**File**: `src/components/feed/ReplyThread.tsx`
- Replies already collapse (toggle exists). Enhance: show collapsed state as "View N replies" with first reply preview, like social media
- Add `<ReactionBar>` under each reply (reusing existing component with `entityType="reply"`)
- Add GIF picker (reusing `GiphyPicker`) to the reply compose area
- Add voice recording button using `MediaRecorder` API: record → upload to storage bucket → store URL

**Database Migration**: Add `gif_url` and `audio_url` (text, nullable) columns to `post_replies` table.

**File**: `src/components/feed/ReplyThread.tsx`
- Show GIF and audio player in each reply
- Audio player: minimal `<audio>` element with controls
- Voice recorder: mic button → recording indicator → stop → auto-upload → attach to reply

---

## 3. Home Page: My Tasks Widget

**File**: `src/pages/Index.tsx`
- New widget card: "My Tasks" showing up to 5 tasks assigned to the current user, sorted by due date
- Each row: status dot, title (truncated), due date badge
- Click navigates to task detail
- "View all" link to `/execution`
- Query: `tasks` where `assigned_to = user.id` and `status != 'done'`, ordered by `due_date asc`, limit 5

---

## 4. Home Page: Quick Links (Favorites)

**Database Migration**: Create `user_favorites` table:
- `id` (uuid, PK), `user_id` (uuid, not null), `label` (text), `url` (text), `icon` (text, default 'Link'), `sort_order` (int), `created_at`
- RLS: users can CRUD their own rows only

**File**: `src/pages/Index.tsx`
- New widget card: "Quick Links" with user's pinned shortcuts
- Each link: icon + label, clickable
- Small "+ Add" button to add new link (inline input for label + URL)
- Delete on hover (X button)

---

## 5. Home Page: Feed Preview

**File**: `src/pages/Index.tsx`
- New widget card: "Feed" showing the 3 most recent feed items (posts, announcements, kudos)
- Compact rendering: avatar, name, truncated content, timestamp
- "View all" link to `/feed`
- Query: fetch latest 3 posts from `posts` table

---

## 6. Home Page Layout Reorganization

Current bottom grid: Reminders | Recent Docs | Activity Feed (3-col)

New layout:
```text
Row 1: [My Tasks (2-col)] [Quick Links (1-col)]
Row 2: [Feed Preview (2-col)] [Reminders (1-col)]
Row 3: [Recent Docs (1-col)] [Activity Feed (2-col)]
```

---

## Technical Details

| Action | File |
|--------|------|
| Edit | `src/components/feed/GiphyPicker.tsx` — Switch to Tenor API |
| Edit | `src/components/feed/ReplyThread.tsx` — Collapsible social-style, reactions, GIF, voice |
| Edit | `src/pages/Index.tsx` — Add My Tasks, Quick Links, Feed Preview widgets |
| Migration | Add `gif_url`, `audio_url` to `post_replies` |
| Migration | Create `user_favorites` table with user-scoped RLS |

