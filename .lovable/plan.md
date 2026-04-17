

Looking at the screenshot, the project page currently shows:
- Header with title, status, assignee, due date, linked goal ✓
- A notes/document area (good — workspace feel)
- Tasks section ✓
- Documents section ✓
- **TWO comment surfaces**: a "Discussion" section at bottom AND an Activity sidebar (right) that includes Comments/Activity tabs with replies

The user wants:
1. **Project = workspace folder feel** (not just a long page)
2. **One unified communication surface** (currently duplicated: Discussion section + sidebar Comments)
3. Tasks tab to become ultra-minimal (separate concern)

Let me check the current ProjectDetailPage and ActivitySidebar to confirm the duplication.

# Plan — Projects as Workspace + Tasks as Speed Layer

## 1. Project Detail = Workspace

Reframe the project page so it visually reads as "a folder you opened," not a long doc.

**Layout (single scroll, sectioned with clear cards):**

```text
┌─────────────────────────────────────────────────┐
│  Workspace breadcrumb · Linked Goal chip        │
│  PROJECT TITLE (large, editable)                │
│  Status · Owner · Due · Team avatars            │
└─────────────────────────────────────────────────┘
┌──────────────────────┬──────────────────────────┐
│ MAIN COLUMN          │ SIDE PANEL (sticky)      │
│                      │                          │
│ ▸ Context (the why)  │ Team (avatars + roles)   │
│   short rich text    │ Key dates                │
│                      │ Linked Goal              │
│ ▸ Planning Notes     │ Files (compact list)     │
│   TipTap workspace   │                          │
│                      │                          │
│ ▸ Tasks              │                          │
│   embedded checklist │                          │
│                      │                          │
│ ▸ Discussion         │                          │
│   ONE thread only    │                          │
└──────────────────────┴──────────────────────────┘
```

**Key changes:**
- **Remove duplicate communication.** Drop the right-side ActivitySidebar's Comments tab on project pages. Keep ONE "Discussion" section in the main column (uses `CommentsSection` for `entity_type=project`). Activity log moves to a small "Recent activity" collapsed footer or a discreet timeline icon in the header that opens a slim popover.
- **Add a Context section** at the top (separate from Planning Notes) — a short "why this project exists" rich text field. Reuses `notes_content` split or adds a lightweight `context` use of existing description field.
- **Right sidebar becomes Workspace Info** — team members, key dates, linked goal, files summary. No comments here.
- **Section cards** with subtle borders / bg-muted/30 backgrounds to give the "rooms in a workspace" feel rather than one flat doc.

## 2. Tasks Tab = Ultra-Minimal

Strip the task list to bare execution mode.

**Row anatomy (single line, ~40px tall):**
```text
○  Task title here................  AA  •  Mar 12
```
- Status bubble (hollow/solid dot — click to cycle)
- Title (click → opens TaskPeekPanel side drawer, already wired)
- Assignee avatar (small, right side)
- Priority dot (tiny colored dot, no label)
- Due date (muted, short format)
- **Removed**: project chip, tag chips, description preview, status badge text

Tighter spacing (`py-2` instead of `py-3`), no card backgrounds, just hover bg.

## 3. Files to Touch

**Modified:**
- `src/pages/ProjectDetailPage.tsx` — restructure into Context + Notes + Tasks + Discussion sections with card framing; drop duplicated comment surface; introduce right-side Workspace Info panel (replacing/trimming ActivitySidebar on this page)
- `src/components/ActivitySidebar.tsx` — accept a prop to hide Comments tab on project pages (or render a slim version), OR replace with a new `ProjectInfoSidebar.tsx`
- `src/components/execution/TableView.tsx` (and `DataTableView.tsx` if used for tasks) — strip task rows to minimal anatomy when viewing the Tasks tab

**New:**
- `src/components/execution/ProjectInfoSidebar.tsx` — clean side panel: team, dates, linked goal, files (no comments/activity feed)

**Reused, no changes:**
- `CommentsSection` (single instance, project entity)
- `TaskPeekPanel` / `DetailDrawer` for task clicks
- `GoalPeek`, `GoalCard`

## 4. What Stays Off
- No new routes
- No DB changes
- Goals tab unchanged (already approved)
- TaskDetailPage route stays dormant for deep links

