# Marquetta Content Automation

## Decision

Marquetta's recurring content work belongs in **OpenClaw Automations**, not
Supabase Cron and not the generic OpenClaw heartbeat. Same split as Ema:

- **OpenClaw Automation** owns *when Marquetta gets an agent turn*.
- **Agent Gateway / Supabase** owns authenticated capabilities, persistence,
  idempotency, authorization, rate limits and audit history.

One scheduler owns each duty. Do not run a generic heartbeat against
`agent_tasks` while these jobs are enabled — two schedulers competing for the
same work source is how duplicate posts get drafted.

## Cadence

Two jobs, deliberately different rhythms.

| Job | Cadence | Purpose |
|---|---|---|
| `Marquetta Content Duty` | every 1 hour | claim queued work: capture, draft, clip |
| `Marquetta Daily Research` | once daily | refresh `content_research` |

Both use an **isolated session** so each run is a bounded background duty cycle
rather than a continuation of an operator conversation.

Cadence is a separate decision from the security design and can be tuned freely.
Start low. Autumn has no established posting rhythm, so the engine should prove
the review queue gets cleared before its output rate goes up — an agent drafting
twenty posts a week that nobody releases is the same failure as no agent at all.

## Recommended OpenClaw jobs

Conceptually:

```bash
openclaw automations create "every 1h" \
  --name "Marquetta Content Duty" \
  --agent marquetta \
  --session isolated \
  --message "Run Marquetta's content duty exactly as defined in the marquetta skill. Claim one task at a time via agent_tasks_next_assigned, work it with approved capabilities only, submit through agent_tasks_submit_result, and never publish. Return NO_REPLY when no human attention is required."

openclaw automations create "0 13 * * *" \
  --name "Marquetta Daily Research" \
  --agent marquetta \
  --session isolated \
  --message "Run Marquetta's content research lane only. Content and marketing research — never real estate research, which is Cash's. Persist findings with sources to content_research. Return NO_REPLY when nothing notable was found."
```

Route exception-only output to the operator, and make both prompts return
`NO_REPLY` on a clean run so hourly executions do not create noise. Use the
hosted instance's existing owner/channel configuration rather than inventing a
destination in this repo.

**Delivery destination: WhatsApp**, not Discord, not Albus's channel, not
OpenClaw chat. Albus's chat runs on Autumn's computer, so anything delivered
there can only be answered at her desk. Discord would have put the setup work
(developer portal) on Autumn rather than on Claude. WhatsApp wins on the fact
that matters most: Autumn already uses message-to-self there as a dump, so the
habit exists rather than needing to be created — and the ad-hoc photo drop, the
primary input for the personal brand, depends on exactly that habit. See
`../marquetta-interaction-model.md` for the full reasoning and the setup cost.

The intake is built as a **generic inbound message table with routing**, not as
a Marquetta feature, so the separate "dump everything, triage agent routes it"
build can add routes later without replacing it.

A third job carries the interaction loop itself:

```bash
openclaw automations create "0 14 * * 1" \
  --name "Marquetta Weekly Check-in" \
  --agent marquetta \
  --session isolated \
  --message "Run Marquetta's weekly check-in as defined in the marquetta skill. Open with what you can already see from captured seeds and fleet activity, name which pillars are short, then ask at most four specific one-line questions weighted toward the underweighted pillars. Rotate the questions week to week. Never ask an open-ended 'what do you want to post about'. Send to Autumn on WhatsApp."
```

Cadence and day are a starting guess, not a finding — adjust once there is
evidence about when she actually answers.

## Duty cycle

Each Content Duty run should:

1. `system_whoami` once.
2. `agent_tasks_next_assigned` to claim one task. **Zero rows means no work —
   that is a normal, successful run, not an error.** Return `NO_REPLY`.
3. Work the task using only approved capabilities for its lane.
4. `agent_tasks_submit_result` with `review` or `blocked`.
5. Repeat until the queue is empty or the run's budget is spent.

The claim is leased and atomic (`agent_task_claim_next`, `FOR UPDATE SKIP
LOCKED`), so overlapping runs cannot be handed the same task and a crashed run's
task returns to the queue when its lease lapses. Marquetta does not need to
reason about any of that — but do not paper over it with a second scheduler.

## Before enabling either job

In order, and do not skip step 4:

1. `agents` row for `marquetta` exists and is **enabled**.
2. Gateway permissions granted for her exact actions.
3. Credential generated, hashed, and injected as the protected env var
   `MARQUETTA_GATEWAY_TOKEN`. Never a literal, never in this repo.
4. **Reload the MCP binding and inspect the live tool inventory.** Confirm every
   allowlisted tool actually exists, then call `system_whoami`. An allowlist
   entry is not a registered tool. If OpenClaw reports *no registered tools
   matched*, fix registration — never widen the allowlist to compensate.
5. One bounded task run end to end, verified in `agent_tasks` and `ai_logs`.
6. Only then enable the Automation.

> **Known blocker at time of writing (2026-09-05).** Ema and Cash are both
> hitting the *no registered tools matched* registration failure; there is an
> open ticket with OpenClaw support. Marquetta's step 4 uses the same path, so
> expect to hit it too. Do not work around it by broadening her tool filter.

## Kill switch

Set `agents.enabled = false` for `marquetta`. `agent_task_claim_next` returns no
work for a disabled agent, so she stops claiming immediately — no container
stop, no credential revoke, no Automation edit required. Use this first if her
output is ever wrong; it is reversible and instant.

Escalating, if more is needed:

| Scope | Action |
|---|---|
| One capability | `agent_permissions.enabled = false` for that action |
| All of Marquetta | `agents.enabled = false` |
| Credential compromised | `agent_api_credentials.revoked_at = now()` |
