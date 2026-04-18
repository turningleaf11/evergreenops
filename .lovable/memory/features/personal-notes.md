---
name: Personal Notes (Notebook Model)
description: Personal scratchpad with notebook tree sidebar, pinned section, and configurable badge blocks in the editor
type: feature
---

Personal scratchpad system featuring a notebook tree sidebar (folders renamed to "notebooks" in UI; underlying table stays `note_folders`). Each notebook has a color (HSL string in `note_folders.color`). Notes have `notebook_id` (FK with ON DELETE SET NULL) and `pinned` boolean.

UI patterns:
- **Sidebar**: Pinned section pinned at top across all notebooks. Then "All Notes" header. Then notebooks list with notes nested visually under each (click notebook row toggles expansion + makes it active — no chevrons, sleek/minimal).
- **Notebook color**: colored BookOpen icon + thin left accent bar + soft tinted background (10% opacity) when active.
- **Note row**: title + small muted date right-aligned (no separate date line). Pin and converted-doc icons appear inline before date.
- **Editor header**: notebook picker (dot+name), pin/unpin toggle, share, convert-to-doc, delete.
- **Unfiled** notes appear in their own section at the bottom when "All Notes" is active.

Editor:
- **Badge block** (`src/extensions/BadgeNode.tsx`) replaces the old fixed Callout. One slash command "Badge" inserts a configurable block. Click the emoji to open a popover and pick a preset (Info/Note/Warning/Success/Idea/Question/Important/TODO), set a custom emoji, or pick a color swatch. Old Callout extension still loaded for back-compat reading of legacy notes.
- **Slash commands**: AI actions (Plan / Extract tasks / Summarize) moved to the **bottom** of the menu so structural blocks appear first.
