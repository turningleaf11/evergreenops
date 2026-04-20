

## Scratch Pad Journal + Persistent Triage

Two changes that work together: archive each scratch pad session when AI processes it, and persist triage results so they survive navigation.

### 1. Archive scratch pads on AI process

- New table `ceo_scratch_pad_archive`: `id`, `user_id`, `content` (HTML, includes images), `triaged_count`, `created_at`.
- When user clicks the AI/Sparkles button:
  1. Run triage as today.
  2. On success, copy current pad content into the archive.
  3. Clear the live pad (so the next session starts fresh).
- Add **"+ New"** icon in the Scratch Pad header → manual clear (with confirm if pad is non-empty; archives before clearing).
- Add **History** icon (clock) in the header → opens a side sheet listing past dumps: date, time, first ~80 chars preview, item count. Click a row to view read-only (rendered HTML + images). Delete from history is allowed.

### 2. Persist triage results across navigation

- New table `ceo_triage_pending`: `id`, `user_id`, `text`, `category` (task/decision/idea/delegation), `suggested_assignee_id`, `suggested_priority`, `reasoning`, `source_archive_id`, `created_at`.
- After triage runs, insert all returned items into this table for the current user.
- `AiTriage` component reads pending items from `ceo_triage_pending` on mount instead of holding them in local state.
- Approving/dismissing/converting an item deletes its row.
- Result: navigate away, come back tomorrow — your triage queue is still there.

### 3. UI tweaks (`ScratchPad.tsx` + `CeoDashboard.tsx`)

- Header right side icon order: History (clock) · New (plus) · Add image · AI process.
- AI button tooltip becomes: "Process & file this page".
- Empty pad with no triage pending shows quiet hint: "Fresh page. Dump anything."
- Triage panel always visible when pending items exist (no longer ephemeral).

### Files

- **Migration**: create `ceo_scratch_pad_archive` and `ceo_triage_pending` tables with RLS (user owns own rows; admins manage all).
- **Edit** `supabase/functions/ceo-triage/index.ts`: after generating items, insert them into `ceo_triage_pending` server-side and return them as today; also archive the pad content. (Needs `user_id` — pull from JWT.)
- **Edit** `src/components/ScratchPad.tsx`: add History sheet, New button, archive-on-process flow, clear after process.
- **Edit** `src/components/AiTriage.tsx`: load pending from DB, delete row on action.
- **Edit** `src/pages/CeoDashboard.tsx`: wire pending-triage subscription so the panel shows whenever rows exist.
- **New** `src/components/ScratchPadHistorySheet.tsx`: side sheet with archive list + read-only viewer.

No new secrets. No new edge functions.

