# GHL Workflow → Call Event Webhook setup

This is how you pipe call dispositions from GHL into EvergreenOps in real-time, so Orbit member performance shows accurate `calls_made` and `conversations` counts without polling the GHL API.

**Why this approach:** GHL Starter doesn't expose `/reports/calls`, and polling per-user message history is expensive. Workflows fire instantly on disposition updates, cost nothing in API quota, and give us the actual disposition value (not a guessed call status).

---

## What's already in place

- ✅ Edge function `orbit-call-webhook` deployed and listening at `https://dsxrekabnwvarnroanny.supabase.co/functions/v1/orbit-call-webhook`
- ✅ Table `orbit_call_events` stores each disposition event (deduplicated by user+contact+minute+disposition)
- ✅ Table `orbit_disposition_map` classifies each disposition as `connected` / `attempt` / `ignore` — seeded with your 12 dispositions from the GHL Lead Workflow doc
- ✅ `orbit-sync-performance` aggregates these events when it runs (nightly via cron, manually via the Sync button)

You only need to do Steps 1 and 2 below.

---

## Step 1 — Set the webhook secret

1. Generate a random secret:
   ```bash
   openssl rand -hex 24
   ```
2. **Supabase Dashboard → Project Settings → Edge Functions → Secrets**
3. Add new secret:
   - Name: `ORBIT_WEBHOOK_SECRET`
   - Value: paste the secret you generated
4. Save.

Keep the secret value handy — you'll paste it into the GHL workflow header next.

---

## Step 2 — Build the GHL Workflow

In GHL, create **one** workflow that fires on every call disposition update. You'll do this once, and it covers all your Orbit reps automatically.

### Workflow trigger
- **Trigger:** `Custom Date Updated` or `Contact Changed` filtered to the call disposition custom field
  - OR if your dispositions live as conversation/activity metadata: use `Inbound Webhook from Internal Source` or `Custom Trigger` from your call activity automation
  - The cleanest trigger: **`Call Status` change** (built-in GHL trigger). Filter to the dispositions you care about.

### Workflow actions

Add a single **Webhook** action:

| Field | Value |
|---|---|
| **URL** | `https://dsxrekabnwvarnroanny.supabase.co/functions/v1/orbit-call-webhook` |
| **Method** | `POST` |
| **Headers** | `Content-Type: application/json`<br>`X-Webhook-Secret: <paste your secret from Step 1>` |
| **Body (JSON)** | (see below) |

### Body template

Paste this into the workflow's custom-body field. GHL substitutes the `{{...}}` tokens with the actual event data:

```json
{
  "ghl_user_id": "{{contact.assigned_to}}",
  "disposition": "{{call.disposition}}",
  "contact_id": "{{contact.id}}",
  "duration": {{call.duration}},
  "occurred_at": "{{call.timestamp}}"
}
```

**Important:**
- `{{contact.assigned_to}}` should be the **GHL user who logged the call** — same value as the `ghl_user_id` you used in the EvergreenOps member picker.
- `{{call.disposition}}` should exactly match one of your call dispositions (e.g. `"Connected – Seller"`).
- `{{call.duration}}` is seconds — optional but nice to have.
- If GHL's token names differ in your workflow builder, just use whatever they call them. The function tolerates several name variants.

### Save & activate the workflow

Toggle to **Active**. Now every disposition update fires a webhook to us.

---

## Step 3 — Verify it works

1. In GHL, log a test call disposition on any contact (use a disposition like "Connected – Seller").
2. In Supabase Dashboard → Edge Functions → orbit-call-webhook → **Logs**, you should see a `200 OK` request within a few seconds.
3. In the Supabase SQL editor, run:
   ```sql
   SELECT ghl_user_id, disposition, occurred_at FROM orbit_call_events ORDER BY occurred_at DESC LIMIT 10;
   ```
   You should see your test event.
4. Click "Sync now" on the test member's drawer. The week's row should show updated `calls` and `conv` counts plus the ⚡ GHL badge.

---

## Disposition classification (edit anytime)

The seeded `orbit_disposition_map`:

| Disposition | Category | Counts as |
|---|---|---|
| Connected – Seller | `connected` | call + conversation |
| Connected – Gatekeeper | `connected` | call + conversation |
| Appointment Set | `connected` | call + conversation |
| Follow Up Requested | `connected` | call + conversation |
| No Answer | `attempt` | call only |
| Left Voicemail | `attempt` | call only |
| Call Failed | `attempt` | call only |
| Wrong Number | `ignore` | excluded |
| Number Disconnected | `ignore` | excluded |
| Do Not Call Requested | `ignore` | excluded |

If your actual GHL dispositions use different wording (e.g. straight hyphens instead of en-dashes), add rows via SQL:
```sql
INSERT INTO orbit_disposition_map (disposition, category) VALUES
  ('YOUR EXACT DISPOSITION STRING', 'connected'); -- or 'attempt' or 'ignore'
```

Or I can build a small admin UI to manage these — let me know.

---

## Cost summary

- **Webhook function invocations:** free (Supabase counts these against your Edge Function quota; you'd need millions/month to hit limits)
- **GHL API calls from us:** 2 per Orbit member per night (deals + appts only — calls flow via webhook, no polling)
- **GHL workflow executions:** unlimited on all GHL plans

You'll never get charged or rate-limited for this.
