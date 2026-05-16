# GHL calls + conversations integration — research notes

**Status:** Not yet implemented. The `orbit-sync-performance` edge function stubs both fields to `0` and falls back to manual entry. This doc captures what we've learned and the path forward.

---

## What we need to pull

Per Autumn:
- **`calls_made`** = raw dial attempts by the user (not just connected)
- **`conversations`** = connected calls (the user actually had a conversation)

Per user, scoped to a week (Monday–Sunday).

---

## What GHL v2 exposes

The bad news: GHL v2 (LeadConnector API) **does not have a clean `/calls` endpoint** that aggregates per-user dial counts. Calls are stored as activity entries on contacts/conversations, not as standalone metrics.

The relevant endpoints:

### 1. `/conversations/search` — most promising
- Returns conversations (which contain messages and call events)
- Filters available: `locationId`, `assignedTo`, `lastMessageDirection`, etc.
- Each conversation has a `lastMessageType` and we'd inspect inner messages for `type = "CALL"`

### 2. `/locations/{locationId}/conversations` — per-message detail
- For each conversation, fetch messages
- Each message has: `type` (CALL, SMS, EMAIL, etc.), `direction`, `body`, `dateAdded`, `userId`
- Filter `type === "CALL"` AND `userId === ghl_user_id` AND `dateAdded` in week
- `direction === "outbound"` to filter to dials only

### 3. `/reports/calls` — possibly available
- Some GHL accounts have a reporting endpoint that returns aggregated call stats
- Tier-dependent — Agency Pro accounts have this, standard accounts may not
- Worth probing during implementation

### 4. Twilio integration (if used) — fallback
- If the GHL account uses Twilio for calling (most do), Twilio API has clean per-user call logs
- But this requires the account's Twilio credentials, not just GHL's API key

---

## Distinguishing "calls" from "conversations"

Once we have per-user call message records:

- **`calls_made`** = `count(messages where type=CALL and direction=outbound and userId=X)`
- **`conversations`** = `count(messages where type=CALL and direction=outbound and userId=X and duration > 30)` *(or some threshold)*

GHL stores `duration` (seconds) and `callStatus` (e.g., "answered", "no-answer", "voicemail", "busy") on call messages. The cleanest signal for "connected" is `callStatus === "answered"` if it's reliably populated.

---

## Recommended implementation path

**Phase C-1: Probe the API in production**
1. Add a temporary diagnostic endpoint that fetches a sample of conversations + messages for one known GHL user
2. Inspect actual response shape — see if `userId`, `callStatus`, `duration` are populated
3. Decide which endpoint and which fields give us the cleanest signal

**Phase C-2: Add a `fetchCallsAndConversations` function to `orbit-sync-performance`**
1. Query conversations filtered by date range (efficient)
2. For each, pull the messages page (1-2 extra API calls per user)
3. Aggregate per user: `calls_made` and `conversations`
4. Cache aggressively — call this endpoint is expensive

**Estimated cost:** 1 conversation list call + ~N message page calls per user per sync. For 20 members, that's ~20-40 API calls. GHL rate limits at ~100/min on standard plan, so well within limits if we sync nightly.

---

## Open questions for Autumn

Before we build Phase C-2, confirm:

1. **What does "connected call" mean to you?** Specifically:
   - Any call where the seller picked up (regardless of duration)?
   - Call lasting > 30 seconds?
   - Call where the user logged a disposition like "Connected – Seller" (GHL has dispositions per the seller lead SOP)?

2. **Disposition-driven counting**:
   - Your "GHL — How to Work Your Leads" doc lists call dispositions (`Connected – Seller`, `Connected – Gatekeeper`, `No Answer`, `Left Voicemail`, etc.)
   - We could count `calls_made` = total disposition events, `conversations` = dispositions of `Connected – Seller` + `Connected – Gatekeeper`
   - This is more reliable than relying on GHL's auto-call-status field
   - But it requires us to extract the disposition from the message body or a custom field

3. **Are you on Agency Pro tier?** If yes, `/reports/calls` may give us a one-shot aggregate that's much cleaner than parsing messages.

Answer these and we can scope a 2-3 hour build of the calls sync.
