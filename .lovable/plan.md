# AI Workshop — Add-On Pack

A lightweight hub to track every AI project you're tinkering with: idea, in build, live, paused, archived. Captures the messy stuff (where it lives, what prompt built it, what the GitHub repo is, useful links, screenshots, notes) in one card per project. Built as an add-on inside Evergreen so the whole team can use it with the same login and access controls you already have.

## Why an add-on (not a separate app)

- You already have auth, RBAC, departments, file uploads, comments, notes editor, AI chat, activity feed — all reusable.
- Add-on pattern (`addon_packs` + `workspace_addons` + `useAddonEnabled`) is exactly what this is for. Toggle on in Settings → Add-Ons, sidebar item appears.
- Sharing with teammates = free (use existing `AccessPicker`: Workspace / Departments / Specific people).
- Future: link an AI project to a CRM deal, a Doc, a Task — all wiring already exists.

## What you get (v1, intentionally minimal)

**One page: `/ai-workshop`** with two views:

1. **Board view** (default) — Kanban columns by stage:
   `Idea → Prototyping → Building → Live → Paused → Archived`
2. **List view** — sortable table (name, stage, platform, owner, last updated)

Plus filter chips: by owner, by tag, by platform.

**Each project = one card** with these fields:

| Field | Type |
|---|---|
| Name | text |
| Stage | status (the 6 above) |
| One-line description | text |
| Tags | multi (e.g. "internal", "client", "experiment") |
| Platform / Built with | multi-select (Lovable, Cursor, Bolt, Replit, Claude, ChatGPT, n8n, Zapier, Make, Custom, Other) |
| Hosted at | URL (live link) |
| GitHub repo | URL |
| Other links | repeating list of {label, url} (Figma, Notion, Loom, demo video, etc.) |
| The prompt | long text (the original or current system prompt) |
| Notes / scratchpad | rich text (TipTap — same editor as Docs) |
| Cover image / screenshot | file upload (uses existing `files` bucket) |
| Attachments | multiple files |
| Owner | profile |
| Collaborators | multi-profile |
| Access | Workspace / Departments / Private (AccessPicker) |
| Created / Updated | auto |

**Detail view** — clicking a card opens a side peek (matches your existing peek pattern) with: header (name + stage badge + links), tabs for **Overview** (all fields) · **Prompt** (big editable text area with copy button) · **Notes** (TipTap) · **Files** · **Comments** (reuses `CommentsSection`).

**Quick add** — "+ New AI Project" button → small dialog: name + stage + one link. Fill in the rest later.

**Optional AI helper** (cheap to add since infra exists) — a "Refine idea" button on the Notes tab that calls `notes-ai` (already deployed) to expand a one-liner into a structured spec. Skip if you want truly minimal.

## Access & sharing

- Add-on toggle: any admin enables "AI Workshop" in Settings → Add-Ons.
- Per-project sharing uses the existing **AccessPicker**: Workspace (everyone), Departments (e.g. only Tech), or Private (specific people).
- Owner + collaborators always have access regardless of visibility setting.
- RLS enforces all of the above server-side.

## What we are NOT building (v1)

To keep it simple and avoid scope creep:
- No cost/token tracking, no health monitoring, no agent runtime, no kanban-of-tasks-per-project (use Execution module if you need that), no public showcase page, no GitHub API sync (just store the URL).
- All of those can be layered in later as v2.

## Where it lives in the UI

- **Sidebar** under "Lists" section: "AI Workshop" (only visible when add-on enabled). Brain/Sparkles icon.
- **Settings → Add-Ons**: new card "AI Workshop — Organize your AI projects from idea to live app."
- **Global Quick Create** (header +): "New AI Project" entry when enabled.

## Technical details

**New tables (single migration):**

- `ai_projects` — id, workspace_id, name, description, stage (text), platforms (text[]), tags (text[]), live_url, repo_url, prompt (text), notes_content (text/HTML), cover_url, owner_id, created_by, visibility, shared_department_ids (uuid[]), shared_member_ids (uuid[]), created_at, updated_at
- `ai_project_links` — id, project_id, label, url, sort_order
- `ai_project_collaborators` — project_id, user_id (PK pair)
- Files: reuse existing `files` table with `entity_type = 'ai_project'`, `entity_id = project.id` — same pattern as leads/deals.

**RLS pattern** (mirrors existing access model):
- SELECT: workspace match AND (visibility=workspace OR owner OR collaborator OR admin OR (visibility=departments AND user dept ∈ shared_department_ids) OR (visibility=private AND user ∈ shared_member_ids))
- INSERT: workspace match, created_by = auth.uid()
- UPDATE/DELETE: owner OR admin OR collaborator

**Add-on registration:** insert into `addon_packs` (slug `ai-workshop`, name, description, icon `Sparkles`, is_active true). Sidebar + route gated by `useAddonEnabled('ai-workshop')`.

**Files / components to add:**
- `src/pages/AiWorkshopPage.tsx` (board + list + filters)
- `src/components/ai-workshop/AiProjectCard.tsx`
- `src/components/ai-workshop/AiProjectPeek.tsx` (Overview / Prompt / Notes / Files / Comments tabs)
- `src/components/ai-workshop/NewAiProjectDialog.tsx`
- Sidebar entry in `src/components/AppSidebar.tsx`
- Route in `src/App.tsx`
- Settings add-on already auto-renders from the catalog.

**Reuses (no new code needed):** RichTextEditor, CommentsSection, AccessPicker, file upload helpers, peek shell, KanbanBoard pattern, useAddonEnabled.

## Confirm before I build

If this matches what you want, approve and I'll ship it as one focused pass: migration + add-on registration + page + peek + dialog + sidebar wiring. Roughly a single session of work.
