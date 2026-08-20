# Supabase Agent Gateway

The Agent Gateway is the security boundary between autonomous OpenClaw agents and Evergreen's business systems. Agents request named capabilities; they never receive Supabase service-role credentials, Google refresh tokens, HighLevel tokens, generic SQL, or arbitrary HTTP access.

## Current Ema scope

Enabled for Ema:

- `system.whoami`
- `email.list`
- `email.search`
- `email.read`
- `email.get_attachment`
- `crm.search_contacts`
- `crm.search_opportunities`
- `crm.list_pipelines`
- `deal.buy_box_fit`
- `deal.intake_to_crm`
- `deal.reconcile_email_update`

Ema owns source-backed deal intake, preliminary buy-box qualification, initial CRM routing, and later reply/document reconciliation. Cash owns financial underwriting. Ema never activates Cash.

## Operating flow

Initial deal:

`Gmail -> Ema extraction -> deal.buy_box_fit -> initial CRM review stage`

Later source update:

`new Gmail message -> read/inspect attachments -> deal.reconcile_email_update -> existing candidate + existing CRM context`

Cash activation is separate and stage-driven:

- SFR pipeline: **Underwriting**
- Portfolio pipeline: **Ready for Napkin**

## MCP adapter

Production endpoint:

```text
https://dsxrekabnwvarnroanny.supabase.co/functions/v1/agent-gateway-mcp
```

Current Ema MCP tool/action map:

- `system_whoami` -> `system.whoami`
- `email_list` -> `email.list`
- `email_search` -> `email.search`
- `email_read` -> `email.read`
- `email_get_attachment` -> `email.get_attachment`
- `crm_search_contacts` -> `crm.search_contacts`
- `crm_search_opportunities` -> `crm.search_opportunities`
- `crm_list_pipelines` -> `crm.list_pipelines`
- `deal_buy_box_fit` -> `deal.buy_box_fit`
- `deal_intake_to_crm` -> `deal.intake_to_crm`
- `deal_reconcile_email_update` -> `deal.reconcile_email_update`

OpenClaw must inject the protected environment variable rather than a literal credential. Ema's `ema-gateway` tool filter must preserve the existing tools and include:

```text
deal_reconcile_email_update
```

Do not alter the MCP URL, Authorization header, `${EMA_GATEWAY_TOKEN}` reference, or any credential while adding the tool. Restart/reload only Ema's MCP binding after changing the filter so discovery refreshes.

## Authentication and authorization

For every Gateway action:

1. Hash the presented bearer credential with SHA-256.
2. Resolve the active credential, agent, and workspace.
3. Enforce the agent enabled kill switch.
4. Require an exact enabled `agent_permissions` action.
5. Consume the action-specific rate limit.
6. Create an authorized operation record.
7. Execute only the fixed server-side capability.
8. Append a sanitized audit event.

Raw credentials never belong in model-visible arguments or logs.

## Buy-box boundary

`deal.buy_box_fit` accepts only a persisted candidate UUID. Asset class, active rules, thresholds, exception behavior, and qualification result are controlled server-side.

Only `rule_type='screen'` is evaluated. `pricing` and `due_diligence` are excluded. SFR flood status is due diligence; fire damage, structural issues, and post-possession are not active inbound blockers; SFR purchase-price/ARV ranges are pricing context.

`fit` and `needs_info` may enter the initial CRM review stage. `not_fit` is blocked from autonomous Ema CRM intake.

## HighLevel boundary

`deal.intake_to_crm` may create or match the initial contact/opportunity using fixed server-side routing and idempotency. It may not advance an existing opportunity beyond the initial stage.

`deal.reconcile_email_update` may add one idempotent **NEW INFORMATION** note to an already-linked CRM deal. It cannot create a new opportunity, change pipeline/stage, send a message, make an offer, or delete/merge records.

## Reply/document reconciliation boundary

`deal.reconcile_email_update` accepts a real Gmail `message_id`, an optional candidate UUID hint, bounded source fact updates, and classifications for attached core portfolio documents only:

- `om`
- `rent_roll`
- `t12`
- `pnl`

Server-side behavior:

- fetch the real Gmail message through the workspace Gmail connection;
- match the source to an existing candidate by the same Gmail thread or source-backed property address;
- treat `candidate_id` only as a disambiguation hint, never as an override;
- reject ambiguous/unmatched sources instead of creating a duplicate candidate;
- verify every supplied attachment ID belongs to that Gmail message;
- persist the Gmail message and candidate/source association;
- persist source-backed document records;
- merge bounded newer source facts while preserving prior source history in evidence;
- recompute `portfolio_document_status`, inventory, and missing OM/Rent Roll/T12/P&L;
- add an idempotent CRM context note when the candidate already has a GHL contact/opportunity;
- return `rerun_buy_box_required=false` because receiving a reply/document is not itself a qualification event.

Ema separately reruns `deal.buy_box_fit` only when the new source materially changes an active screen fact.

## Durable Phase 2 state

`ema_candidate_sources` records every original/later Gmail source associated with a candidate and how it was matched (`origin`, `thread_reply`, or `address_match`).

`ema_candidate_documents` records verified Gmail attachments classified as OM, Rent Roll, T12, or P&L.

These tables are workspace-scoped, RLS-protected, and service-role writable only behind the Gateway.

## Audit privacy

Audit records include agent, action, resource identifier, result, duration, and sanitized error metadata. They exclude authorization headers, raw credentials, Google tokens, email bodies, attachment contents, raw Gmail search queries, and source fact values supplied to reconciliation.

## Production acceptance

Before considering reconciliation complete, verify:

- Ema alone has `deal.reconcile_email_update` permission;
- the MCP tool appears in Ema's live tool inventory after tool-filter reload;
- same-thread reply matches the existing candidate without creating another candidate/opportunity;
- multi-property thread requires address evidence or a valid candidate hint that is itself source-verified;
- cross-thread update matches only when the property address appears in the source;
- unrelated email is rejected;
- attachment IDs not present on the source message are rejected;
- repeated reconciliation does not duplicate source/document/note records;
- OM/Rent Roll/T12/P&L inventory and missing list update correctly;
- CRM stage remains unchanged;
- buy-box is not rerun solely because a document arrived;
- no raw credential appears in prompts, logs, repository files, or agent-visible tool arguments.
