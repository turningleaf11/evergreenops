

# Scratch Pad + Command Tab Cleanup

## 1. Convert Scratch Pad to Rich Text with Slash Commands

Replace the plain `<textarea>` in `ScratchPad.tsx` with the same TipTap `RichTextEditor` used in docs/tasks/projects. This gives you `/` slash commands (headings, lists, checklists, callouts, tables, image upload, etc.) out of the box.

- The content will be stored as HTML (same as docs) in the `ceo_scratch_pad.content` column (already text, no migration needed)
- Image paste/drop still works (TipTap already handles this via the slash command image upload)
- The `onProcess` callback will send the editor's text content + any embedded image URLs to the AI triage function

## 2. Better Triage Feedback — Show Where Items Go

When approving a triage item, instead of just a generic toast, show a toast with:
- The destination name (e.g. "Task created in Execution", "Idea added to Strategy Items", "Decision logged")
- A clickable link in the toast that navigates to the relevant page (Execution page for tasks, Strategy tab for ideas/decisions)

This way you always know where your stuff went.

## 3. Move Morning Reset Under Top Priorities

In the Command tab, instead of the current layout (2-column grid for Briefing + Priorities, then Morning Reset below), move Morning Reset to sit directly beneath Top Priorities within the same column. The layout becomes:

| Left Column | Right Column |
|-------------|-------------|
| CEO Briefing | Top Priorities |
| | Morning Reset (below priorities) |

## Files

| Action | File |
|--------|------|
| Edit | `src/components/ScratchPad.tsx` — Replace textarea with TipTap RichTextEditor, extract text+images for AI processing |
| Edit | `src/components/AiTriage.tsx` — Add destination labels and navigation links to approval toasts |
| Edit | `src/pages/CeoDashboard.tsx` — Move MorningReset under TopPriorities in the right column of Command tab |

