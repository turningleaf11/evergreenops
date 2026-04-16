

# Wiki/Notes White Background + Borderless Social Composer

## 1. Wiki & Notes — White Content Area

**Approach**: Keep the left sidebars tinted (`bg-muted/30`) as they are. Make only the content/editor area use a white background (`bg-white dark:bg-card`). This creates the "paper on desk" effect — no "white, grey, white" sandwich since the sidebar stays tinted.

**File**: `src/pages/DocsPage.tsx`
- Line 248: Change `<div className="flex-1 p-6 overflow-auto">` to add `bg-white dark:bg-card`

**File**: `src/pages/NotesPage.tsx`
- Line 337: Change `<div className="flex-1 flex flex-col min-w-0">` to add `bg-white dark:bg-card`

Both pages already have tinted sidebars (`bg-muted/30`), so the contrast will feel natural — muted nav on left, clean white paper on right.

---

## 2. Borderless Social-Media Composer

**File**: `src/components/feed/FeedComposer.tsx` — Full rewrite of the UI structure.

**Collapsed state** (current: bordered input pill):
- Keep avatar + clickable trigger, but make it a naked text prompt — no border, no background. Just `"What's on your mind?"` as muted placeholder text next to the avatar. A thin bottom divider separates it from the feed.

**Expanded state** — strip all form boxes:

- **Main textarea**: Naked — no border, no background, no rounded container. Just a clean `textarea` with `border-0 bg-transparent focus:ring-0 resize-none`. Larger font (`text-base`) to make it feel like the primary surface.

- **Mode tabs**: Keep as-is (already styled well with filled active state). Move them above the textarea as a subtle row.

- **Announcement title**: Replace bordered input with a naked bold input — `border-0 bg-transparent text-lg font-semibold placeholder:text-muted-foreground/40`. Separated from body by a thin `border-b border-border/30` underline only.

- **Poll question**: Same naked bold input. Poll options use a minimal underline style — `border-0 border-b border-border/30 rounded-none bg-transparent` — instead of boxed inputs.

- **Kudos selectors**: Keep Select components but with reduced chrome — `border-border/30 bg-transparent`.

- **Action bar**: A thin `border-t border-border/20` divider, then icons (Photo, GIF) on left as ghost buttons, Post button on right. No extra padding or containers.

- **Overall container**: Keep the outer card with subtle elevation, but remove the inner `bg-primary/[0.02]` tinted wrapper. The card itself is the boundary — everything inside is borderless and open.

The result: Avatar on left, open writing space on right, thin dividers instead of boxes, action icons along the bottom. Like Twitter/LinkedIn compose — not a form.

---

## Technical Summary

| Action | File |
|--------|------|
| Edit | `src/pages/DocsPage.tsx` — Add `bg-white dark:bg-card` to content area |
| Edit | `src/pages/NotesPage.tsx` — Add `bg-white dark:bg-card` to editor area |
| Edit | `src/components/feed/FeedComposer.tsx` — Borderless social-media style rewrite |

No database changes. No new dependencies.

