# Orbit nightly GHL sync — cron setup

The `orbit-sync-performance` edge function is **already deployed and verified**.
Manual sync works today via the "Sync from GHL" button on the Roster tab and the per-member "Sync now" link in the member drawer.

To enable nightly auto-sync, follow these steps **in the Supabase Dashboard** (one-time setup):

---

## Step 1 — Set a cron secret

This protects the function from anyone hammering it without admin auth.

1. Go to **Supabase → Project Settings → Edge Functions → Secrets**
2. Click **Add new secret**
3. Name: `ORBIT_CRON_SECRET`
4. Value: any long random string. Generate one in your terminal:
   ```bash
   openssl rand -hex 24
   ```
   (or use any password generator — 40+ characters)
5. Save.

The edge function will read this and only accept cron calls whose `X-Cron-Secret` header matches.

---

## Step 2 — Schedule the nightly job

1. In the Supabase Dashboard, go to **Database → Cron Jobs**
2. Click **Create a new cron job**
3. Fill in:
   - **Name:** `orbit-sync-performance-nightly`
   - **Schedule:** `0 6 * * *` (runs at 6:00 AM UTC — adjust if you want a different local time)
   - **Type:** **HTTP Request**
   - **Method:** `POST`
   - **URL:** `https://dsxrekabnwvarnroanny.supabase.co/functions/v1/orbit-sync-performance`
   - **HTTP Headers:**
     ```
     Content-Type: application/json
     X-Cron-Secret: <paste the secret you generated in Step 1>
     ```
   - **HTTP Body:**
     ```json
     {"all": true}
     ```
4. Save & enable.

---

## Step 3 — Test it once manually

Right after creating the job, click **Run now** on the cron job page. You should see:
- A successful 200 response in the cron job history
- An updated `ghl_synced_at` timestamp on each linked member
- New rows (or updated rows) in `orbit_performance_snapshots` with `source = 'ghl'`

If you see a 401, the secret didn't match. Double-check `ORBIT_CRON_SECRET` matches the header value exactly.

---

## What runs each night

For every Orbit member with `status IN ('active', 'on_notice')` AND `ghl_user_id IS NOT NULL`:
- Fetches their **deals won this week** (Mon–Sun) from `/opportunities/search`
- Fetches their **appointments set this week** (where they're the `createdBy.userId`) from `/calendars/events`
- Upserts a row into `orbit_performance_snapshots` for the current Mon date with `source = 'ghl'`
- Updates `ghl_synced_at` on the member

**Not yet synced from GHL** (manual entry still works for these):
- `calls_made` — dial attempts. See `docs/ghl-calls-research.md` for the integration plan.
- `conversations` — connected calls. Same.

---

## Troubleshooting

**"GHL not configured" in cron history**
- Check Settings → Credentials in the app. `GHL_API_KEY` and `GHL_LOCATION_ID` must both be set, or set them as Supabase env vars.

**"401 Unauthorized" in cron history**
- The `X-Cron-Secret` header value doesn't match `ORBIT_CRON_SECRET` env var. Reset both to be safe.

**Sync runs but numbers are all 0**
- Most likely the member's `ghl_user_id` doesn't match real GHL activity, OR GHL returned data but the field name we're checking (`createdBy.userId` for appts) is different in your tenant.
- Check the Supabase Edge Function logs for the function — look for `GHL <status>` errors.
