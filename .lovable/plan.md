

# Proactive AI Greeting on Strategy Page

## Summary

When the companion is opened while on the CEO Dashboard (`/`), it automatically sends a proactive greeting — a situational summary of overdue tasks, stalled projects, pending decisions, and recent changes. On other pages, the companion opens as a blank chat ready for conversation.

## How it works

1. **CompanionContext** tracks whether a greeting has already been sent this session (to avoid re-triggering on every open/close)
2. When `open` becomes `true` and the user is on `/` (CEO Dashboard) and no messages exist yet, the context automatically:
   - Queries Supabase for: overdue tasks, stalled/blocked projects, recent decisions, open issues, recent activity events
   - Sends a special system-level "snapshot" payload to the `ceo-chat` edge function alongside a synthetic user message like `[MORNING_BRIEFING]`
3. The edge function recognizes this marker and generates a conversational situational greeting using the snapshot data
4. On all other pages, the companion opens normally with the empty state prompts

## What changes

| What | File |
|------|------|
| Add snapshot fetch + auto-greeting logic | Edit: `src/contexts/CompanionContext.tsx` |
| Add snapshot data to edge function context handling | Edit: `supabase/functions/ceo-chat/index.ts` |

### CompanionContext changes
- Add a `greetingSent` ref to prevent duplicate greetings
- When `open` flips to `true`, check: is pathname `/`? Are messages empty? Has greeting not been sent?
- If yes: query Supabase for overdue tasks (`due_date < today`, status not `done`), projects with status `blocked` or `at_risk`, recent `decision_log` entries, open `issues`, and last 24h `activity_events`
- Send this snapshot object as `liveSnapshot` in the request body alongside a synthetic `[MORNING_BRIEFING]` user message (hidden from UI)
- The assistant response streams in as normal

### Edge function changes
- Detect when the first user message is `[MORNING_BRIEFING]`
- Append a briefing instruction to the system prompt: "The user just opened their command center. Greet them with a brief, conversational situational summary based on the live snapshot. Highlight what needs attention — overdue items, blocked projects, pending decisions. Be concise. End by asking what they want to focus on."
- Include the `liveSnapshot` data in the system prompt context

### No database changes needed
All data already exists in tables: `tasks`, `projects`, `decision_log`, `issues`, `activity_events`.

