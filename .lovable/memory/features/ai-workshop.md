---
name: AI Workshop add-on
description: Lightweight project tracker for AI builds (idea→live), with prompts, links, notes, files, and team sharing via AccessPicker.
type: feature
---
Add-on slug `ai-workshop`. Toggled in Settings → Add-Ons. Sidebar entry under Apps when enabled.

Tables: `ai_projects`, `ai_project_links`, `ai_project_collaborators`, `ai_project_files`. RLS via `can_access_ai_project` (workspace/dept/private + owner/collab/admin) and `can_edit_ai_project` (owner/collab/admin).

Page `/ai-workshop`: board (kanban by stage) + list views, search filter. Stages: idea, prototyping, building, live, paused, archived. Peek sheet with Overview / Prompt / Notes / Files / Access tabs. Reuses RichTextEditor, AccessPicker, file-upload helper, `files` storage bucket.

Tables accessed via `as any` cast since types lag migration (per addon-packs convention).
