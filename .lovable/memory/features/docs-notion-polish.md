---
name: Docs/Notes Notion-class polish
description: Cover image, emoji icon, drag handles, slash menu categories, backlinks panel, click-below-to-focus
type: feature
---
- `documents` and `notes` have `cover_url` (text) and `icon` (text/emoji) columns.
- `DocCover` component renders cover image + emoji picker above the title.
- `BacklinksPanel` queries docs/notes content for `data-mention-id="<id>"` and lists hits at the bottom of every doc/note. Clicks open via mention peek.
- TipTap borderless editor: `min-height: 70vh`, click below content focuses cursor at end. Hover ⋮⋮ drag handle on every block (CSS-only).
- Slash menu grouped by category: Basic / Lists / Layout / Media / AI with section headers.
- DocsPage and NotesPage sync `selectedDoc` / `selectedId` with `?id=` URL param so the peek "Open full doc/note" button works.
