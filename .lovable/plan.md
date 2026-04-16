

# Phase 3 + Multi-Feature Bundle

A lot here. Grouping into sub-phases so it ships cleanly. Phase 3 (tables) is the heaviest — keeping it focused.

---

## A. Sidebar improvements

### A.1 Tooltips on collapsed sidebar
**`src/components/AppSidebar.tsx`** — when `state === "collapsed"`, wrap each `SidebarMenuButton` with shadcn `Tooltip` (right side). Show route title on hover.

### A.2 Sidebar sits under header + overlay expand
- **`src/components/Layout.tsx`** — restructure: header becomes top-level full-width (`h-[60px] sticky top-0 z-40`). Below it, a flex row with `<AppSidebar>` + `<main>`.
- **`src/components/ui/sidebar.tsx`** — adjust the Sidebar `top: 0` → `top: 60px` and `height: calc(100vh - 60px)`.
- **Overlay-on-expand**: When sidebar is collapsed, expanding it should float OVER content (not push). Switch `collapsible="icon"` behavior so the expanded panel uses `position: absolute; left: 0; z-30` overlay rather than reflowing the main column. Click anywhere on the collapsed rail (empty space) → expand. Click outside → collapse.

---

## B. Wiki status + grouping

### B.1 DB migration
Add `status` column to `documents` table:
```sql
ALTER TABLE documents ADD COLUMN status text NOT NULL DEFAULT 'active';
-- values: draft, review, needs_update, active, deprecated, archived
```
No CHECK constraint — use validation in app + status options enum in TS.

### B.2 RLS policy update
Update SELECT policy on `documents`: regular users only see `status = 'active'`. Admins/leadership see all. Use existing `has_role()` helper.

### B.3 `DocsPage.tsx` UI
- Status pill on each doc (color-coded: active=green, draft=grey, review=amber, needs_update=orange, deprecated=red, archived=muted)
- Status editor in doc header (admin/leadership only)
- **Grouping** in middle panel (replace flat list):
  - Per-department sections (collapsible) for docs scoped to a department
  - "Workspace" section for workspace-visible docs
  - "Shared with me" section for private docs explicitly shared with current user
  - Each section collapsible, persisted in localStorage

---

## C. Comments + companion enhancements

### C.1 Attachments + @mentions in all comment/reply boxes
**`src/components/CommentsSection.tsx`** + **`src/components/feed/ReplyThread.tsx`** + **`src/components/feed/FeedComposer.tsx`**:
- New shared `<RichCommentInput>` component with:
  - Paperclip button → file upload to existing `files` storage bucket → attach metadata to comment
  - `@` trigger → mention popover listing workspace members (reuses existing profiles query) → inserts `@[Name](user_id)` token, rendered as a pill chip
- Add `attachments jsonb`, `mentions uuid[]` columns to `comments` table (migration)
- Render attachments as chips below comment text; mentions as inline chips

### C.2 Reactions on all comments
- New table `comment_reactions (id, comment_id, user_id, emoji, created_at)` with unique `(comment_id, user_id, emoji)` and RLS
- Reaction picker: 8 emojis (👍 ❤️ 🤜 🔥 💪 😂 🤗 🚀)
- Inline below each comment + each feed post
- **`src/components/feed/ReactionBar.tsx`** already exists — extend it to accept arbitrary emoji set and use it in CommentsSection too

### C.3 Attach in AI companion
**`src/components/GlobalCompanion.tsx`**, **`src/components/CeoAiChat.tsx`**, **`src/components/LeadershipAiChat.tsx`**, **`src/components/home/HomeAiChat.tsx`**:
- Add paperclip button next to send. Upload to `files` bucket. Send file URL/metadata as part of the message context to the edge function.

---

## D. Drawer/peek polish

### D.1 Editable title in drawer
**`src/components/DetailDrawer.tsx`** + **`src/components/DatabaseRecordDetail.tsx`**:
- Replace static `<SheetTitle>{record.title}</SheetTitle>` with click-to-edit input (contentEditable or Input on focus, blur autosaves).

### D.2 Peek view selector at top-right of drawer header
Move the existing peek mode toggle (Side / Center / Full) from wherever it currently sits to the top-right of `SheetHeader`, next to the close button. Compact icon-button group, no labels. Per attached screenshot: just the 3 icons clustered near the X.

---

## E. Phase 3 — Inline-editable, unified table & list views

### E.1 New shared components
- **`src/hooks/useColumnWidths.ts`** — `(viewKey: string) => { widths, setWidth }` backed by localStorage, key `spreadsheet:{viewKey}`
- **`src/components/shared/InlineCell.tsx`** — renders edit UI by column type:
  - `text` → click → contentEditable, blur autosaves
  - `select/status` → click → popover with options
  - `multi-select` → click → multi-select popover
  - `date` → click → date picker
  - `number` → click → number input
- **`src/components/shared/SpreadsheetTable.tsx`** — grid with soft `border-border/30` vertical + horizontal lines, resizable column headers (drag handle on right edge, persists via `useColumnWidths`), hover-to-reveal `Maximize2` icon on title cell to open drawer
- **`src/components/shared/ListRows.tsx`** — same inline editing, only horizontal dividers, card-row aesthetic preserved

### E.2 Wire up
- **`src/components/execution/DataTableView.tsx`** → uses `SpreadsheetTable`
- **`src/components/execution/TableView.tsx`** → uses `ListRows`
- **`src/components/DatabaseView.tsx`** → both table/list modes use the shared components, with column defs from `databases_meta.columns`

---

## Files Summary

| Action | File |
|--------|------|
| Edit | `src/components/AppSidebar.tsx` — tooltips on collapsed |
| Edit | `src/components/Layout.tsx` — header above sidebar |
| Edit | `src/components/ui/sidebar.tsx` — top offset + overlay-expand |
| New  | Migration: `documents.status` + RLS update + `comments.attachments/mentions` + `comment_reactions` table |
| Edit | `src/pages/DocsPage.tsx` — status pill, status editor, grouped sections |
| New  | `src/components/shared/RichCommentInput.tsx` — attach + @mention input |
| Edit | `src/components/CommentsSection.tsx` — uses RichCommentInput + reactions |
| Edit | `src/components/feed/ReplyThread.tsx`, `FeedComposer.tsx`, `PostCard.tsx` — same |
| Edit | `src/components/feed/ReactionBar.tsx` — extend emoji set, generic |
| Edit | `src/components/GlobalCompanion.tsx`, `CeoAiChat.tsx`, `LeadershipAiChat.tsx`, `home/HomeAiChat.tsx` — attach button |
| Edit | `src/components/DetailDrawer.tsx` — editable title, peek selector top-right |
| Edit | `src/components/DatabaseRecordDetail.tsx` — same |
| New  | `src/hooks/useColumnWidths.ts` |
| New  | `src/components/shared/InlineCell.tsx` |
| New  | `src/components/shared/SpreadsheetTable.tsx` |
| New  | `src/components/shared/ListRows.tsx` |
| Edit | `src/components/execution/DataTableView.tsx` — use SpreadsheetTable |
| Edit | `src/components/execution/TableView.tsx` — use ListRows |
| Edit | `src/components/DatabaseView.tsx` — use shared components |

DB migrations required for: `documents.status`, `comments.attachments`/`mentions`, `comment_reactions` table.

