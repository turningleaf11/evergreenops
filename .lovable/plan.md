

# Multi-feature Polish: Feed, Home, Composer, Kanban, Launcher

## 1. Reply UX — light primary tint + collapsed by default
**File**: `src/components/feed/ReplyThread.tsx`
- Restructure into two parts via a `mode` prop: `"toggle"` (just shows count + reply button) and `"content"` (the actual replies + composer)
- Wrap reply composer in `bg-primary/[0.04] rounded-xl p-3` for the soft tint
- Add a sticky "Comment" + "Reply" buttons beside the reactions (handled in PostCard already — just hide composer until expanded)

**File**: `src/components/feed/PostCard.tsx`
- Already has `repliesExpanded` state — composer should only render when expanded (it does). Issue is `ReplyThread` always shows composer even when there are 0 replies expanded. Confirm composer appears only inside the expanded block (it does already — but tint the wrapper now).
- Add a "Comment" button label next to the chevron (icon + "Comment" text)

## 2. Trello-Style Kanban Board Enhancement
**File**: `src/components/execution/KanbanBoard.tsx`
- Add **colored top stripe** to each card (3px) using priority/tag color (matches uploaded mockup)
- Wrap board in horizontal scroll with `overflow-x-auto` and tinted column backgrounds (`bg-muted/30 rounded-xl p-2`)
- Sticky column headers with item count badge
- Add a subtle "+ Add card" button at the bottom of each column (calls a new optional `onAddCard?: (status) => void` prop — wired from ExecutionPage to create a quick task in that status)
- Card hover: subtle lift (`hover:-translate-y-0.5 hover:shadow-lg transition-all`)
- Reduce card padding, increase font hierarchy (title bolder, meta smaller)

## 3. Inline AI Chat on Home — "What are you working on?"
**New widget** `feed_chat` → register in `src/components/home/widgetRegistry.ts`
**New file**: `src/components/home/HomeAiChat.tsx`
- Compact chat surface that lives in the home grid as a widget
- Prompt input "What are you working on?" with a Send button
- On submit: posts to existing `ceo-chat` edge function (or new lightweight `home-chat` if ceo-chat is admin-restricted — will reuse `ceo-chat` for admins, fall back to `leadership-chat` otherwise)
- Renders inline conversation thread (last ~5 turns) within the widget card, no modal, no sheet
- Default visible in left column, sort_order = 0

## 4. Quick Links → Header "Launcher" button
**New file**: `src/components/LauncherMenu.tsx`
- Rocket icon button in header (between TimeClock and GlobalCreateMenu)
- Opens a `Popover` with the user's `user_favorites` (label + URL)
- Inline add form (label + URL) and per-row delete
- Reuses existing `user_favorites` table

**File**: `src/components/Layout.tsx`
- Add `<LauncherMenu />` to right zone

**File**: `src/components/home/widgetRegistry.ts` + `src/pages/Index.tsx`
- Remove `quick_links` from `WIDGET_REGISTRY` (or set default `visible: false`). Keep render case for backward compat but hide from customizer.

## 5. Announcements Visual Importance
**File**: `src/pages/Index.tsx` (announcements widget render)
- Use type-based color stripe + icon background:
  - `urgent` → red, `celebration` → amber, `policy` → indigo, `update` → blue, `general` → primary
- Each announcement gets a 3px left border in its type color, type-tinted icon chip, larger title font, type label as a small chip
- Pinned ones: stronger background tint (`bg-{color}/8`) and Pin icon emphasized

## 6. Feed Page Whitespace Fix
**File**: `src/pages/CompanyFeedPage.tsx`
- Container is `max-w-2xl mx-auto` — appears too narrow / left-shifted because sidebar is wide. Change to `max-w-3xl mx-auto px-4 lg:px-8` and center properly. Verify with viewport.

## 7. Home: Horizontal Feed at Top + Column Toggle (1 vs 2 col)
**File**: `src/components/home/FeedPreview.tsx`
- Add a `variant` prop: `"vertical"` (current) and `"horizontal"` (new)
- Horizontal: `flex gap-3 overflow-x-auto snap-x` with each post as a 280px-wide compact card (smaller font, truncated content, single image thumb)

**File**: `src/pages/Index.tsx`
- Render `feed_preview` widget **above** the 2-column grid as a dedicated full-width row with `variant="horizontal"`
- Remove `feed_preview` from the column-based render loop

**Layout mode toggle (single vs double column)**:
- Add layout state `layout: "single" | "double"` to `useWidgetPreferences` (persist as a new `home_layout_preferences` row OR localStorage for simplicity — use **localStorage** to avoid a migration)
- Toggle in header next to "Customize" button (icons: `Columns` / `Square`)
- Single mode: render all visible widgets in one column (`max-w-3xl mx-auto`)
- Double mode: existing 2-column layout
- DnD already supports cross-column moves — works in double mode; in single mode, all widgets flow vertically and reorder freely

## 8. Docs/Notes — White Input Boxes
**File**: `src/components/RichTextEditor.tsx`
- The TipTap content area inherits muted background. In `RichTextEditor.css`, ensure `.ProseMirror` has `background: white` in light mode (and `dark:bg-card` via wrapper)

**File**: `src/pages/DocsPage.tsx` & `src/pages/NotesPage.tsx`
- Inputs (title fields) — change any `bg-muted` / default `bg-background` to explicit `bg-white dark:bg-card`
- Tag chips area: ensure white background

---

## Technical Summary

| Action | File |
|--------|------|
| Edit | `src/components/feed/ReplyThread.tsx` — primary tint composer wrapper |
| Edit | `src/components/feed/PostCard.tsx` — add "Comment" label to toggle |
| Edit | `src/components/execution/KanbanBoard.tsx` — Trello styling, +Add card, hover lift |
| New | `src/components/home/HomeAiChat.tsx` — inline AI chat widget |
| Edit | `src/components/home/widgetRegistry.ts` — add `feed_chat`, drop `quick_links` |
| New | `src/components/LauncherMenu.tsx` — header rocket button popover |
| Edit | `src/components/Layout.tsx` — add LauncherMenu |
| Edit | `src/pages/Index.tsx` — type-colored announcements, horizontal feed at top, layout toggle |
| Edit | `src/components/home/FeedPreview.tsx` — horizontal variant |
| Edit | `src/pages/CompanyFeedPage.tsx` — wider container, proper centering |
| Edit | `src/components/RichTextEditor.css` — white ProseMirror bg |
| Edit | `src/pages/DocsPage.tsx`, `src/pages/NotesPage.tsx` — white input bg |

No DB migrations needed. Layout toggle stored in localStorage.

