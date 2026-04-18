---
name: project-ai-tab
description: AI partner inside each project — dedicated tab + edge function grounded in project data, with task generation tool calling.
type: feature
---
Each project has an "AI" tab (rightmost) powered by the `project-chat` edge function (Lovable AI, gemini-3-flash-preview).

**Grounding context** sent on every request: project metadata (title/status/priority/due/team), notes_content, all tasks (grouped by status), linked documents (titles), recent comments (last 8), and linked goal title.

**Tool calling**: AI uses `propose_tasks` to generate task lists. UI shows a confirm panel — user can remove individual items, then "Add N tasks" inserts directly into `tasks` table linked to the project. Tasks default to medium priority.

**Quick actions** on empty state: Plan & sequence, Generate tasks, Status & risks, What should I focus on next.

**Access**: Open to anyone on the project (lead + assignees). NOT gated to admins, unlike the global Companion. This is a deliberate divergence from `mem://ai/executive-companion-logic`.

**Shared util**: SSE streaming (text + tool calls) lives in `src/lib/ai-stream.ts`. Reuse this for any new AI streaming UIs.

**Notes slash AI**: Inside the TipTap RichTextEditor, the slash menu exposes `AI: Plan`, `AI: Extract tasks`, `AI: Summarize` (top of menu). They call the `notes-ai` edge function (Lovable AI, gemini-3-flash-preview, streaming) with the editor's plain text and stream the markdown reply directly into the editor at the cursor. Action types: `plan`, `tasks`, `summarize`, `expand`, `rewrite` (last two reserved for future).

**Comments layout**: `CommentsSection` renders two ways. With `hideHeader` (rails/peeks/drawers using full height), composer is anchored at the bottom and the comment list scrolls above it. Without `hideHeader` (inline detail panels), it lays out naturally as a vertical stack. UI label is always "Comments" — never "Discussion".
