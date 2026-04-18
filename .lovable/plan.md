

# Project Workspace 2.0 — Overview + Tabs + Built-in Whiteboards

## Layout

```text
┌──────────────────────────────────────────────────────────┐
│ Title · Status · Owner · Due · Linked Goal   [💬 Chat ▸] │  ← header w/ chat toggle
├──────────────────────────────────────────────────────────┤
│ [Overview] Notes  Tasks  Whiteboards  Files              │  ← tabs (no Discussion tab)
├──────────────────────────────────────────┬───────────────┤
│                                          │ DISCUSSION    │
│   TAB CONTENT                            │ (right rail,  │
│                                          │  collapsible) │
└──────────────────────────────────────────┴───────────────┘
```

- **No Discussion tab.** Discussion lives as a **collapsible right rail**, toggled by a chat button in the project header. Default = collapsed; opens as a 360px panel that overlays gracefully.
- Same chat toggle works on every tab (including fullscreen whiteboard) so chat is always one click away.
- Tab state persists per-project in localStorage.

## Tab Contents

**Overview (default)** — dashboard cards:
- Recent activity feed
- Notes preview (first paragraph + "Open notes")
- Open tasks count + next 3 due
- Whiteboards thumbnails (up to 3)
- Files (recent 5)
- Team avatars + linked goal chip

**Notes** — full TipTap editor, full width, distraction-free.

**Tasks** — embedded minimal task list (reuses ultra-minimal row style from execution Tasks tab).

**Whiteboards** — grid of board cards. Two creation options:
- **+ New whiteboard** → built-in canvas (using **tldraw** — open-source, embeddable, mature)
- **+ Embed external** → paste Miro / Figma / FigJam URL, renders as an iframe card

Click a board → opens fullscreen editor. Right-rail chat still accessible.

**Files** — clean list/grid of attachments, drag-drop upload to Supabase `files` bucket.

## Database Changes

New table `whiteboards`:
- `id, project_id, workspace_id, title, type ('native' | 'embed'), tldraw_data jsonb, embed_url text, created_by, created_at, updated_at`
- RLS: workspace members read, owner/admin write

New column on `projects`: `last_active_tab text` (optional, for restore — or use localStorage)

Files use existing `files` bucket + a new `project_files` table or `entity_links` polymorphic.

## Files to Touch

**New**:
- `src/pages/ProjectDetailPage.tsx` — full restructure into header + tabs + collapsible right rail
- `src/components/execution/ProjectOverviewTab.tsx` — dashboard cards
- `src/components/execution/ProjectNotesTab.tsx` — TipTap full-bleed
- `src/components/execution/ProjectTasksTab.tsx` — minimal list (reuses TableView in compact mode)
- `src/components/execution/ProjectWhiteboardsTab.tsx` — grid + create modal
- `src/components/execution/ProjectFilesTab.tsx` — file grid
- `src/components/execution/WhiteboardEditor.tsx` — tldraw canvas wrapper, autosaves to `tldraw_data`
- `src/components/execution/WhiteboardEmbedCard.tsx` — iframe wrapper
- `src/components/execution/ProjectChatRail.tsx` — collapsible right rail wrapping `CommentsSection`

**Modified**:
- `src/components/execution/ProjectInfoSidebar.tsx` — repurposed into Overview tab cards (deprecated as sidebar)

**Dependency**: add `@tldraw/tldraw` (~1MB gzipped, lazy-loaded only when Whiteboards tab opens)

## Phasing

1. **Phase 1** — Tabs + chat rail + Overview/Notes/Tasks/Files (no whiteboards). Ships the new shape.
2. **Phase 2** — Whiteboards tab with tldraw native + embed support.

Approve Phase 1 first, then we tackle whiteboards as a focused follow-up.

