## Why nothing is syncing

I called the live Fathom API with your stored `FATHOM_API_KEY` and confirmed the account has 1 meeting available. I also called the deployed `fathom-sync` edge function — it returns `{ "fetched": 0, "synced": 0 }`. The cause is that the edge function was written against a guessed Fathom schema that doesn't match the real API.

Real Fathom response (verified):
```
GET https://api.fathom.ai/external/v1/meetings
{
  "items": [ { "recording_id": 139825347, "title": "...", "scheduled_start_time": "...",
               "recording_start_time": "...", "share_url": "...", "url": "...",
               "default_summary": null, "transcript": null, "action_items": null,
               "calendar_invitees": [...], "recorded_by": { "email": "..." } } ],
  "next_cursor": null,
  "limit": 10
}
```

Bugs in current `supabase/functions/fathom-sync/index.ts`:

1. Response unwrapping looks for `meetings` / `data` / `results` — Fathom uses **`items`**. Falls through to `[]`, so `fetched: 0`.
2. ID extraction uses `m.id || m.meeting_id`. Fathom's identifier is **`recording_id`** (number). Even if items were unwrapped, every row would be skipped as "no id".
3. Summary mapping misses **`default_summary`**.
4. Host email is at **`recorded_by.email`**, not a top-level `host_email`.
5. Attendees field is **`calendar_invitees`**, not `invitees`/`attendees`.
6. Started-at: `recording_start_time` is missing from the field list (only `scheduled_start_time` is checked).
7. The `since` filter is built from `meetings.synced_at` (when we last synced), not from the newest meeting time. After one successful sync this becomes "now", which would hide future meetings if Fathom honored it. Safer to omit `since` entirely (upsert is idempotent) and rely on `recording_id` conflict.
8. No pagination. Fathom returns `next_cursor`; we should follow it so accounts with >limit meetings sync fully. (Not blocking your case since you only have 1, but worth fixing now.)

## Fix

Rewrite the mapper and fetch loop in `supabase/functions/fathom-sync/index.ts`:

- Unwrap `json.items` (keep the existing fallbacks as belt-and-suspenders).
- `fathom_id = String(m.recording_id ?? m.id ?? m.meeting_id ?? '')`.
- `started_at = m.recording_start_time ?? m.scheduled_start_time ?? m.started_at ?? null`.
- `summary = m.default_summary ?? m.summary ?? m.ai_summary ?? null`.
- `host_email = m.recorded_by?.email ?? m.host_email ?? null`.
- `attendees = m.calendar_invitees ?? m.attendees ?? m.invitees ?? []`.
- `recording_url = m.share_url ?? m.url ?? m.recording_url ?? null` (already close, just reorder so `share_url` wins).
- Compute `duration_seconds` from `recording_end_time - recording_start_time` when not explicitly provided.
- Drop the `since` query param (idempotent upsert handles dedupe). Add a small pagination loop that follows `next_cursor` until empty or a sane safety cap (e.g., 20 pages).
- Log `fetched` and `synced` counts on the server for future debugging.

No DB schema changes. No client changes. After redeploy, the user clicks "Sync from Fathom" on `/meetings` and the existing recording will appear; future ones will sync on each click.

## Verification

1. Redeploy `fathom-sync`.
2. Call it via the test endpoint and confirm `fetched >= 1, synced >= 1`.
3. Open Meetings page → Recordings tab → confirm the row, share URL, host, and recording link render.
