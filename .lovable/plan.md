

## Build plan: Cadences + Holidays + Meetings (Fathom)

### 1. Cadences (Operating Rhythms)

New Execution Hub tab — "the recurring work that keeps the business running." Replaces the lightweight `recurring_tasks_templates` concept with a proper control plane.

**Naming:** Going with **"Cadences"** (Rhythms is the runner-up — easy to swap in one constant if you change your mind).

**Tab placement:**
```text
Execution Hub:  Goals · Projects · Tasks · Cadences · Issues
```

**Cadence record:**
- Title, description, owner, department, SOP doc link (optional)
- Schedule: daily / weekly (pick day) / monthly (pick date) / custom cron
- Auto-generated task template: title, default priority, est. duration
- Health: streak (on-time completions), miss count, last run, next due

**Generation engine:**
- Edge function `cadences-generate` runs nightly via `pg_cron`
- For each active cadence due today/tomorrow, creates a `tasks` row assigned to owner with `due_date` set, tagged `cadence:<id>` so we can roll up health

**Control plane view (the new tab):**
- Card-enhanced list (matches Tasks/Projects style)
- Per row: name, owner avatar, cadence chip ("Every Monday"), streak badge, next due, status dot (green=on track, amber=upcoming, red=missed)
- Filters: by department, by owner, by status
- Click row → side peek with run history + linked SOP

**Home integration (no new widget):**
- In `MyTasksWidget` "Today" tab: cadence-generated tasks get a small **🔄 Cadence** chip next to the title and a thin amber left-border if overdue. Sorted to top. That's the "important/highlighted" treatment.

**Schema:**
```sql
cadences (id, workspace_id, title, description, owner_id, department_id, 
          sop_doc_id, schedule_type, schedule_config jsonb, 
          task_template jsonb, is_active, created_by, timestamps)

cadence_runs (id, cadence_id, generated_task_id, due_date, 
              completed_at, status, created_at)
```
RLS: workspace-visible read; admins + owner can edit; owner can mark runs complete.

---

### 2. Holidays

**Settings page** → new "Calendar & Holidays" section.
- Toggle: "US Federal Holidays" (preloaded, on by default)
- Custom list: name + date + recurring (annual/one-time) + color
- Admin-editable only

**Schema:**
```sql
workspace_holidays (id, workspace_id, name, date, is_recurring, color, created_by)
```

**Wiring into "This Week":**
- `ThisWeekWidget` adds a 4th source: holidays in the current week → 🎉 dot
- US federal holidays come from a static JSON in `src/lib/us-holidays.ts` (computed for current year), workspace overrides come from the table
- Empty state copy: "Quiet week — no birthdays, holidays, or meetings."
- Per your call: tasks/reminders stay OUT.

---

### 3. Fathom Meetings — full app integration

You record on Fathom, we sync everything into your portal. You'll get recording playback, transcript, summary, action items, and 1-click conversion to tasks — all without leaving the app.

**Required:** `FATHOM_API_KEY` (I'll prompt via secrets after approval).

**Schema:**
```sql
meetings (id, workspace_id, fathom_meeting_id UNIQUE, title, 
          started_at, duration_seconds, recording_url, 
          transcript_text, summary, host_email, attendees jsonb, 
          synced_at, created_at)

meeting_action_items (id, meeting_id, text, assignee_email, 
                      assignee_user_id, converted_task_id, 
                      completed, sort_order)
```
RLS: workspace-visible. Action items completable by assignee or admin.

**Edge functions:**
- `fathom-sync` — pulls new meetings since `max(synced_at)`, upserts meetings + action items, matches attendee emails to `profiles`
- `fathom-webhook` — optional realtime endpoint Fathom posts to when a recording finishes (so meetings appear within seconds, not on cron)
- Cron: every 15 minutes as a fallback

**`/meetings` page:**
- Left rail: meeting list (date, title, duration, attendee avatars)
- Right pane (selected meeting):
  - Header: title, date, attendees
  - Tabs: **Summary** · **Action items** · **Transcript** · **Recording**
  - Recording tab embeds the Fathom playback URL
  - Transcript tab: searchable, scrollable, speaker-labeled
  - Action items: checkbox list + "Convert to task" button (creates a `tasks` row, links via `converted_task_id`)
  - Right sidebar: linked Project picker (uses `entity_links`)

**Sidebar nav:** new "Meetings" entry under the main section.

**Mention support:** `@meeting:...` becomes a peek (like docs/tasks) showing summary + jump-to-recording.

---

### "Build our own app on Fathom API?"

Short take: **no, not worth it for now.** Fathom's edge is the Zoom/Meet bot + the AI summarization pipeline — replacing those is a multi-month project. The smart play is exactly what we're doing: keep Fathom as the recording engine, own the workspace-of-record (this app). If later you want recording independence, the natural path is to add a second provider (Otter, Read.ai, or your own bot via Recall.ai) behind the same `meetings` table — the UI doesn't change.

I noted this as a future option but won't build it now.

---

### Files

```text
NEW   supabase/migrations/*_cadences.sql
NEW   supabase/migrations/*_holidays.sql
NEW   supabase/migrations/*_meetings.sql
NEW   supabase/functions/cadences-generate/index.ts
NEW   supabase/functions/fathom-sync/index.ts
NEW   supabase/functions/fathom-webhook/index.ts
NEW   src/pages/CadencesPage.tsx       (rendered inside ExecutionPage tab)
NEW   src/components/cadences/CadenceList.tsx
NEW   src/components/cadences/CadenceEditor.tsx
NEW   src/pages/MeetingsPage.tsx
NEW   src/components/meetings/MeetingList.tsx
NEW   src/components/meetings/MeetingDetail.tsx
NEW   src/components/meetings/ActionItemList.tsx
NEW   src/lib/us-holidays.ts
EDIT  src/pages/ExecutionPage.tsx       — add Cadences tab
EDIT  src/pages/SettingsPage.tsx        — Holidays section
EDIT  src/components/home/ThisWeekWidget.tsx — add holidays + meetings sources
EDIT  src/components/home/MyTasksWidget.tsx  — cadence chip + sort
EDIT  src/components/AppSidebar.tsx     — Meetings entry
EDIT  src/App.tsx                       — /meetings route
EDIT  src/extensions/MentionExtension.tsx — meeting type
```

After approval I'll request `FATHOM_API_KEY` before scaffolding the Fathom pieces. Cadences + Holidays can ship first and don't need any secrets.

