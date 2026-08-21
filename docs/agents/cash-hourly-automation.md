# Cash Hourly Underwriting Automation

## Decision

Cash's recurring underwriting pickup belongs in **OpenClaw Automations**, not Supabase Cron and not a generic free-form heartbeat.

- **HighLevel stage change** is the human activation authority and creates/reopens the durable Cash work item.
- **OpenClaw Automation** owns *when Cash gets an agent turn* to claim pending work.
- **Agent Gateway / Supabase** owns authentication, queue claiming, persistence, idempotency, permissions, rate limits, and audit history.

This keeps human approval in HighLevel and avoids building a second callback from Supabase into OpenClaw.

## Cadence

Production default: **every 1 hour**, 24/7.

Use an isolated Cash session. Do not configure a second generic Cash heartbeat to poll underwriting while this automation is enabled.

## Required Cash MCP surface

The hosted Cash agent should expose only the narrow underwriting tools it needs:

- `cash-gateway__system_whoami`
- `cash-gateway__underwriting_next_work_item`
- `cash-gateway__underwriting_cash_value`

Do not add Ema email, CRM, deal-intake, generic SQL/RPC, or another agent's MCP tools to Cash.

## Recommended OpenClaw job

Conceptually:

```bash
openclaw automations create "every 1h" \
  --name "Cash Hourly Underwriting" \
  --agent cash \
  --session isolated \
  --message "Run Cash's hourly underwriting duty exactly as defined in the Cash skill. Verify identity, claim or resume the next approved SFR underwriting work item, continue only with source-backed evidence and approved underwriting capabilities, never fabricate comps or assumptions, and return NO_REPLY when there is no queued work or no human attention is required."
```

During burn-in, no-delivery is acceptable while run history is inspected. In production, route exception-only output to the owner/operator and return `NO_REPLY` for clean/no-work runs.

## V1 duty cycle

Each hourly run should:

1. Call `system_whoami` once and require agent slug `cash`.
2. Call `underwriting_next_work_item` with no arguments.
3. If no SFR work item is available, return `NO_REPLY`.
4. If a work item is returned, use its server-issued opportunity/candidate identity and `completed_phases`; do not substitute a caller-selected opportunity.
5. If `cash_value` is incomplete, call `underwriting_cash_value` using the persisted opportunity or candidate identity.
6. Use only real/source-backed subject facts and sold comps. If the approved provider/tool cannot produce defensible evidence, do not invent comps; surface the blocker for human attention.
7. When CashValue succeeds, the Gateway persists the `cash_value` underwriting step. The overall Cash work item remains active because rehab/MAO/final phases are not yet implemented in the autonomous runtime.
8. Do not send offers, move CRM stages, or mark the deal approved.

## Queue behavior

`underwriting_next_work_item` is deliberately narrow:

- accepts no caller-controlled routing fields;
- resumes an already-active SFR item after an agent restart before claiming another;
- otherwise claims the oldest/highest-priority queued SFR item;
- does not claim Portfolio work until the Portfolio napkin engine exists;
- uses row locking so concurrent Cash turns cannot claim the same queued item independently.

The HighLevel stage trigger remains the only normal way to create/reopen the work envelope. Ema completeness and buy-box fit do not activate Cash.

## Current V1 completion boundary

The autonomous runtime currently implements:

1. work claim/resume;
2. source-backed SFR CashValue;
3. durable `cash_value` phase persistence.

The next engineering phases are rehab, MAO/pricing, DealCheck preparation, and final review persistence. Until those are implemented, a successful CashValue is **not** a completed underwriting recommendation and must not move the task to `review` or `done`.

## Verification after hosted setup

1. Confirm Cash's live tool inventory contains exactly the three approved Cash tools above.
2. Run `system_whoami` and confirm slug `cash`.
3. Call `underwriting_next_work_item` before any test stage movement and confirm it returns no work.
4. Create the hourly OpenClaw Automation and record its job ID.
5. Disable any other Cash polling heartbeat/automation so only one recurring underwriter pickup job exists.
6. Move one controlled SFR opportunity into the approved HighLevel `Underwriting` stage.
7. Verify the authenticated HighLevel workflow event creates one Cash work item and one Agent Task.
8. Force-run the Cash automation once; verify it claims that exact work item.
9. Run CashValue only with real/source-backed evidence and verify `cash_underwriting_steps.phase='cash_value'` is persisted.
10. Confirm the Agent Task remains `in_progress` after CashValue and the next phase is rehab.
11. Re-run the automation and verify it resumes the same active item instead of creating/claiming a duplicate.
