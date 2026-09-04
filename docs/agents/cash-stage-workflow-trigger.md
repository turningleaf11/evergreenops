# Cash HighLevel Workflow Trigger

## Purpose

HighLevel stage movement remains the human/business-state activation authority for Cash, but the SFR webhook no longer creates durable underwriting work immediately.

For SFR the production path is:

```text
HighLevel Pipeline Stage Changed
        ↓
authenticated cash-stage-trigger / signed ghl-stage-events receiver
        ↓
ghl_stage_events audit row
        ↓
cash_activation_signals pending
        ↓
Cash later calls underwriting_next_work_item
        ↓
Gateway verifies the opportunity against LIVE HighLevel
        ↓
JIT durable Cash work/task only if still eligible
```

The webhook says **“this opportunity entered Underwriting.”** Live HighLevel later answers **“is it still eligible right now?”** Supabase/OpsHQ records **“Cash actually started work.”**

Portfolio/Napkin behavior is separate and is not changed by the SFR JIT design.

## Approved SFR trigger

| Pipeline | Pipeline ID | Trigger stage | Stage ID | Work kind |
| --- | --- | --- | --- | --- |
| SFR | `w3OtDJjCdN840Hwb1fpt` | Underwriting | `1c3468f6-1a5d-4025-bf20-2bc4bd195708` | `sfr_underwriting` |

## Security boundary

The workflow webhook is notification, not underwriting authority.

The request payload accepts only:

```json
{
  "opportunity_id": "<HighLevel opportunity ID>"
}
```

Client-supplied pipeline IDs, stage IDs, workspace IDs, candidate IDs, agent IDs, URLs, or work kinds are rejected.

After authentication, the receiver rereads the opportunity from HighLevel using Evergreen's server-side HighLevel credential. The SFR receiver records an activation signal only for the exact approved pipeline/stage route.

Cash itself does **not** receive generic HighLevel access. The later JIT eligibility read remains server-side behind Agent Gateway.

The workflow credential is separate from the Cash Gateway credential. Do not reuse `CASH_GATEWAY_TOKEN`, `EMA_GATEWAY_TOKEN`, a HighLevel PIT, or any Supabase service-role credential.

- Raw workflow token: stored only in HighLevel's protected Custom Webhook configuration.
- SHA-256 token hash: stored server-side for authentication.
- The raw token is never stored in Postgres.
- Invalid requests are audited without storing the Authorization header.

## HighLevel workflow configuration

The existing `Cash - Underwriting Stage Trigger` workflow remains the SFR activation front door.

Settings:

- `Allow Re-entry`: ON
- `Allow Multiple Opportunities`: ON
- opportunity-based workflow context

Custom Webhook:

- Method: `POST`
- URL: `https://dsxrekabnwvarnroanny.supabase.co/functions/v1/cash-stage-trigger`
- Header: `Authorization: Bearer <CASH_STAGE_WORKFLOW_TOKEN>`
- Header: `Content-Type: application/json`
- Body: only the triggering `opportunity_id`

Use HighLevel's Opportunity ID dynamic-value picker rather than guessing a merge token.

## SFR idempotency and re-entry

A retry of the same authenticated stage event reuses the same activation signal. A genuine later re-entry into Underwriting creates a newer `activation_count`.

`cash_work_items` remains unique by `(workspace_id, ghl_opportunity_id, work_kind)`. A later activation may reopen/reuse that same durable envelope rather than creating a duplicate task.

The current activation is never sufficient by itself to authorize work. Before JIT claim the Gateway requires live HighLevel to show all of:

- pipeline `w3OtDJjCdN840Hwb1fpt`;
- stage `1c3468f6-1a5d-4025-bf20-2bc4bd195708`;
- status `open`;
- property type `Single Family Residence`.

If the deal moved to DEAD, was abandoned, left Underwriting, entered another pipeline, or is not SFR, the pending signal is made stale and no new underwriting work is created.

## `needs_info` and later re-entry

If CashValue or Acquisition Rehab returns durable `needs_info`, the current activation is blocked/released and its signal is made stale with a phase-specific reason. Cash may continue to another activation.

If a human later moves that opportunity out of and back into Underwriting after the missing information is resolved, the new webhook event receives a higher activation count and can reopen the existing envelope.

## Acceptance test

1. Move a controlled SFR opportunity into Underwriting.
2. Confirm `ghl_stage_events` records an authenticated event.
3. Confirm exactly one pending `cash_activation_signal` exists for that activation.
4. Confirm stage entry alone does **not** create a new Cash work item/task.
5. Move one test opportunity out of Underwriting before Cash runs; verify JIT polling makes its signal stale without underwriting it.
6. Leave another valid SFR open in Underwriting; let the real hosted Cash agent poll and verify the work item/task is created only at JIT claim.
7. Verify repeated/concurrent polling cannot duplicate the claim.
8. Verify a `needs_info` result blocks/releases only that activation and Cash can continue to another deal.
9. Move the opportunity out and genuinely back into Underwriting; verify a new activation count reopens/reuses the same durable envelope.
10. Do not use Ema completeness or buy-box fit as a substitute Cash activation trigger.