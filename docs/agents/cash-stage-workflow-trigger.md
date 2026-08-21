# Cash HighLevel Workflow Trigger

## Purpose

Cash underwriting is activated only after a human moves a HighLevel opportunity into an approved Cash trigger stage.

Primary production trigger:

- HighLevel `Pipeline Stage Changed` workflow
- authenticated outbound `Custom Webhook`
- `cash-stage-trigger` Supabase Edge Function
- live HighLevel opportunity verification
- `reconcile_cash_stage_trigger_v2`
- persistent Cash work item / Agent Task Board task

The existing Marketplace `ghl-stage-events` Ed25519 receiver remains available as a fallback, but it is not required for the workflow-based activation path.

## Approved trigger stages

| Pipeline | Pipeline ID | Cash trigger stage | Stage ID | Work kind |
| --- | --- | --- | --- | --- |
| SFR | `w3OtDJjCdN840Hwb1fpt` | Underwriting | `1c3468f6-1a5d-4025-bf20-2bc4bd195708` | `sfr_underwriting` |
| Portfolio | `K6YsnZw6qhYLvXSvuixD` | Ready for Napkin | `a4c70dff-3832-427f-adb7-a3945a175783` | `portfolio_napkin` |

## Security boundary

The workflow webhook is notification, not authority.

The request payload accepts only:

```json
{
  "opportunity_id": "<HighLevel opportunity ID>"
}
```

Client-supplied pipeline IDs, stage IDs, workspace IDs, candidate IDs, agent IDs, URLs, or work kinds are rejected.

After authentication, the receiver rereads the opportunity from HighLevel using Evergreen's server-side HighLevel credential. Cash is activated only when the live opportunity is currently in one of the approved pipeline/stage pairs above.

The workflow uses a dedicated credential. Do not reuse `CASH_GATEWAY_TOKEN`, `EMA_GATEWAY_TOKEN`, a HighLevel PIT, or any Supabase service-role credential.

- Raw workflow token: stored only in HighLevel's Custom Webhook configuration / protected secret location.
- SHA-256 token hash: stored in `public.app_settings` under `CASH_STAGE_WORKFLOW_TOKEN_SHA256`.
- The raw token is never stored in Postgres.
- Invalid requests are audited without storing the Authorization header.

## HighLevel workflow configuration

Create one workflow named:

`Cash - Underwriting Stage Trigger`

Add two `Pipeline Stage Changed` triggers:

1. SFR pipeline -> `Underwriting`
2. Portfolio pipeline -> `Ready for Napkin`

Workflow settings:

- `Allow Re-entry`: ON
- `Allow Multiple Opportunities`: ON

The workflow must be opportunity-based so the webhook action retains the triggering opportunity context.

Add one `Custom Webhook` action:

- Method: `POST`
- URL: `https://dsxrekabnwvarnroanny.supabase.co/functions/v1/cash-stage-trigger`
- Header: `Authorization: Bearer <CASH_STAGE_WORKFLOW_TOKEN>`
- Header: `Content-Type: application/json`
- JSON body: one field only, `opportunity_id`, populated from the workflow's Opportunity ID dynamic-value picker.

Do not manually type a guessed merge-field token when the HighLevel variable picker is available. Select the triggering Opportunity ID from the picker and verify the workflow's test payload before publishing.

## Idempotency and re-entry

The receiver derives its event identity from:

- live HighLevel opportunity ID
- live pipeline ID
- live stage ID
- live HighLevel `date_updated`

A retry of the same stage-change delivery reuses the same audit event. A later stage re-entry has a new HighLevel update timestamp and can reopen/reuse the existing Cash work item without creating a duplicate task.

`cash_work_items` remains unique by `(workspace_id, ghl_opportunity_id, work_kind)`.

## Acceptance test

1. Publish the HighLevel workflow.
2. Move a controlled SFR opportunity into `Underwriting`.
3. Confirm `ghl_stage_events` records an authenticated `ghl_workflow_bearer` event.
4. Confirm `cash_work_items` contains the matching `sfr_underwriting` envelope.
5. Confirm Agent Task Board contains the Cash task.
6. Move the opportunity out of the trigger stage and back in.
7. Confirm the same work item/task is reused or reopened and `activation_count` increments.
8. Do not use Ema completeness or buy-box fit as a Cash activation trigger.
