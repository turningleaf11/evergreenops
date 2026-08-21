# Ema Hourly Inbox Automation

## Decision

Ema's recurring inbox work belongs in **OpenClaw Automations**, not Supabase Cron and not the generic OpenClaw heartbeat.

- **OpenClaw Automation** owns *when Ema gets an agent turn*.
- **Agent Gateway / Supabase** owns authenticated business capabilities, persistence, idempotency, authorization, rate limits, and audit history.
- **HighLevel stage events** independently own Cash activation.

This avoids building an HTTP bridge from Supabase back into OpenClaw just to start a model-backed Ema run, and avoids two independent schedulers competing for the same inbox responsibility.

OpenClaw's own heartbeat guidance says recurring tasks belong in Automations. Heartbeat can be disabled per agent with `every: "0m"`; there is no need to run Ema's inbox duty in both surfaces.

## Cadence

Production default: **once per hour**, 24/7.

Use an isolated Ema session so each run is a bounded background duty cycle rather than a continuation of an operator conversation.

Do not configure Ema's heartbeat prompt to do inbox review while this job is enabled. Prefer disabling Ema's generic heartbeat (`every: "0m"`) unless it is deliberately used for a separate health-monitoring purpose.

## Recommended OpenClaw job

Use the documented `automations create` shape: schedule first, prompt second, then pin the Ema agent and isolated session.

```bash
openclaw automations create "0 * * * *" \
  "Run Ema's hourly inbox duty exactly as defined in the ema skill. Use a 2-hour Gmail lookback, rely on Gateway idempotency for overlap, process new deals and existing-deal updates, and never activate Cash. Return NO_REPLY when no human attention is required." \
  --name "Ema Hourly Inbox Intake" \
  --agent ema \
  --session isolated
```

`0 * * * *` means once at the top of every hour. An exact wall-clock timezone is not required for an hourly cadence; the job remains hourly across DST changes.

Delivery should be configured intentionally on the hosted instance:

- During burn-in, add `--no-deliver` while operators inspect run history.
- For normal production, route exception-only output to the existing operator/owner destination. The prompt returns `NO_REPLY` on a clean run, and OpenClaw suppresses a `NO_REPLY`-only result rather than delivering hourly noise.
- Configure failure alerts on the hosted instance so repeated execution failures are surfaced even when normal clean runs are silent.

Use the hosted instance's existing owner/channel configuration rather than inventing a destination ID in the repository.

## Duty cycle

Each run should:

1. `system_whoami` once.
2. Compute `after_epoch_seconds = now - 2 hours`.
3. `email_list({ after_epoch_seconds, max_results: 50 })`.
4. Follow `next_page_token` when present, but cap the run at 4 pages / 200 messages. Overflow requires human attention.
5. For each plausible acquisition email/update:
   - `email_read` the complete thread;
   - inspect relevant attachments with `email_get_attachment`;
   - preserve source conflicts and unknowns.
6. For a genuinely new deal, call `deal_persist_email_intake`.
7. If persistence returns `existing_thread`, use `deal_reconcile_email_update` only for supported new facts/documents.
8. For each new persisted candidate:
   - call `deal_buy_box_fit`;
   - if `fit` or buy-box `needs_info`, call `deal_intake_to_crm` when the source-intake candidate is otherwise eligible;
   - if `not_fit`, do not route it into CRM.
9. Do not create Cash work. Cash starts only from the configured HighLevel stage event.
10. Return `NO_REPLY` unless a person must intervene.

## Source-intake vs buy-box `needs_info`

These are different states:

- A legitimate, identifiable property with missing facts should normally persist with `intake_result = supported` and list the unknown fields in `missing_information`; it continues to buy-box screening.
- `intake_result = needs_info` is reserved for a source that is too incomplete or ambiguous to proceed safely through normal intake.
- `buy_box_fit_result = needs_info` is a reviewable screen result and may enter the fixed initial CRM review stage when the candidate is otherwise intake-eligible.

This distinction prevents Ema from treating ordinary missing deal facts as a reason to strand a legitimate lead before the team's review stage.

## Why the 2-hour lookback is intentional

The schedule is hourly, but the inbox query overlaps the prior hour. This protects against:

- a late scheduler run;
- a Gateway restart;
- transient Gmail/API failures;
- a run timing out after seeing a message but before finishing downstream work.

The Agent Gateway and durable Ema tables own deduplication/lifecycle:

- Gmail message identity is unique in `ema_messages`;
- candidate identity is stable within the persisted message;
- `deal_persist_email_intake` returns existing state rather than creating another candidate;
- existing Gmail threads are redirected to reconciliation;
- buy-box results derive durable candidate screen states;
- parent message state rolls up from candidate progress;
- CRM writes remain idempotent.

Do not replace this with a model-maintained `last_checked_at` memory value.

## Supabase Cron — when it would be appropriate

Supabase Cron is appropriate when the scheduled unit is deterministic server-side work, for example:

- SQL maintenance;
- stale-state cleanup;
- nightly aggregation;
- calling a Supabase Edge Function that does not need an agent/model turn.

It is not the preferred owner for Ema inbox review because Ema's job requires an OpenClaw agent turn with her skill and tool policy. A Supabase cron would need another authenticated endpoint or queue to wake OpenClaw, creating an unnecessary second orchestration layer.

## Verification after hosted setup

After the new Gateway capability is deployed and the OpenClaw tool filter is reloaded:

1. Confirm `deal_persist_email_intake` appears in Ema's live tool inventory.
2. Inspect `openclaw automations list --all --agent ema` and identify any existing Ema heartbeat/automation jobs.
3. Create the hourly automation and record its job ID.
4. Disable/remove any older Ema inbox polling automation so exactly one recurring inbox job remains.
5. Disable Ema's generic heartbeat for inbox work (`every: "0m"`) unless it has a separately defined health-only purpose.
6. Force-run the job once with `openclaw automations run <job-id> --wait`.
7. Inspect `openclaw automations runs --id <job-id>` and confirm a successful isolated Ema turn.
8. Verify Gateway audit history shows `system.whoami`, email reads, and only the deal actions actually needed by the test message.
9. Repeat the forced run against the same lookback and confirm it does not create duplicate `ema_messages`, `ema_candidates`, contacts, opportunities, or notes.
10. Confirm completed/not-fit multi-candidate messages roll up to durable terminal message state correctly.
11. Confirm the next natural run is approximately one hour later.
