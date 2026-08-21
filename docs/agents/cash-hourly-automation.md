# Cash Hourly Underwriting Automation

## Decision

Cash's recurring underwriting pickup belongs in **OpenClaw Automations**, not Supabase Cron and not a generic free-form heartbeat.

- **HighLevel stage change** is the human activation authority and creates/reopens the durable Cash work item.
- **OpenClaw Automation** owns *when Cash gets an agent turn* to claim pending work.
- **Agent Gateway / Supabase** owns authentication, queue claiming, persistence, idempotency, exact action permissions, rate limits, and audit history.

This keeps human approval in HighLevel and avoids building a second callback from Supabase into OpenClaw.

## Cadence

Production default: **every 1 hour**, 24/7.

Use an isolated Cash session. Do not configure a second generic Cash heartbeat to poll underwriting while this automation is enabled.

## Hosted MCP namespace policy

Cash keeps one stable authenticated MCP connection: `cash-gateway` using Cash's own credential.

The preferred hosted OpenClaw/HeyRon filter is:

- allow `cash-gateway__*` for the Cash agent;
- do not attach or reuse Ema's MCP connection or credential;
- rely on Supabase `agent_permissions` as the authoritative exact action allowlist.

A hosted namespace wildcard does **not** grant backend authorization. Every Gateway request still resolves the authenticated Cash identity and must pass the exact per-agent action permission, rate limit, validation, and audit boundary.

Do not ask hosted support to add one individual Cash underwriting tool at a time while the permanent wildcard/dynamic-discovery configuration is being resolved.

Current Cash underwriting tools implemented by the Gateway are:

- `cash-gateway__system_whoami`
- `cash-gateway__underwriting_next_work_item`
- `cash-gateway__underwriting_cash_value`
- `cash-gateway__underwriting_rehab`

Cash must not receive Ema email, CRM, or deal-intake authority through backend permissions even if those tools exist on the shared MCP implementation.

## Recommended OpenClaw job

Conceptually:

```bash
openclaw automations create "every 1h" \
  --name "Cash Hourly Underwriting" \
  --agent cash \
  --session isolated \
  --message "Run Cash's hourly underwriting duty exactly as defined in the Cash skill. Verify identity, claim or resume the next approved SFR underwriting work item, continue only with source-backed evidence and approved underwriting capabilities, never fabricate comps, repair scope, costs, or assumptions, and return NO_REPLY when there is no queued work or no human attention is required."
```

During burn-in, no-delivery is acceptable while run history is inspected. In production, route exception-only output to the owner/operator and return `NO_REPLY` for clean/no-work runs.

## Current SFR duty cycle

Each hourly run should:

1. Call `system_whoami` once and require agent slug `cash`.
2. Call `underwriting_next_work_item` with no arguments.
3. If no SFR work item is available, return `NO_REPLY`.
4. If a work item is returned, use its server-issued opportunity/candidate identity and `completed_phases`; do not substitute a caller-selected opportunity.
5. If `cash_value` has not **succeeded**, call `underwriting_cash_value` using the persisted opportunity or candidate identity.
6. Use only real/source-backed subject facts and sold comps. If the approved provider/tool cannot produce defensible evidence, do not invent comps. A `needs_info` CashValue remains the current phase and must not advance to rehab.
7. Once `cash_value` has succeeded, build a source-aware repair scope from available evidence. Do not invent repair needs merely to complete a category list.
8. Call `underwriting_rehab` only with the active opportunity ID and source-backed scope items. Cash may supply category, scope level, description, evidence class, source type/reference, and a source-backed quantity when known. Cash cannot supply unit costs or contingency.
9. The Gateway prices scope only from the active Evergreen Rehab Cost Book. Missing rates or required quantities return `needs_info`; unresolved rehab remains the current phase rather than advancing.
10. When Rehab succeeds, the Gateway persists `cash_underwriting_steps.phase='rehab'` and the next phase becomes `mao`.
11. MAO/pricing is not yet implemented in the autonomous runtime. Until it is, surface that phase boundary rather than inventing pricing logic.
12. Do not send offers, move CRM stages, or mark the deal approved.

## Rehab evidence classes

Rehab V1 distinguishes the basis for each scope item:

- `verified` — verified inspection, contractor quote, human-verified scope, or equivalent authoritative evidence;
- `observed` — a repair condition visible/observed in a source such as property photos but not yet contractor-verified;
- `source_claim` — seller, broker, email, property-sheet, or other unverified claim.

Confidence is capped accordingly. Unknown remains unknown. The agent cannot submit an `assumed` evidence class.

## Rehab Cost Book boundary

Repair money is deterministic policy, not model judgment.

- Cost-book rates are workspace-scoped and versioned.
- Exactly one book may be active for the workspace.
- Every rate must carry provenance such as an Evergreen completed-project reference, approved vendor quote, or approved published estimator/source.
- No production dollar rates are seeded by the Rehab V1 migration.
- Cash cannot send or override unit costs, cost-book units, or contingency through MCP.
- Missing cost-book coverage yields `needs_info`; Cash does not fill the gap from memory or a generic $/sqft shortcut.

This explicitly avoids treating legacy ARVA placeholder condition-based $/sqft values as Evergreen policy.

## Queue behavior

`underwriting_next_work_item` is deliberately narrow:

- accepts no caller-controlled routing fields;
- resumes an already-active SFR item after an agent restart before claiming another;
- otherwise claims the oldest/highest-priority queued SFR item;
- does not claim Portfolio work until the Portfolio/Napkin engine exists;
- uses row locking so concurrent Cash turns cannot independently claim the same queued item;
- returns only **successfully completed** phases. `needs_info`, `blocked`, or failed phases do not advance the sequence.

The HighLevel stage trigger remains the only normal way to create/reopen the work envelope. Ema completeness and buy-box fit do not activate Cash.

## Current completion boundary

The autonomous SFR runtime now implements:

1. work claim/resume;
2. source-backed SFR CashValue;
3. durable `cash_value` phase persistence;
4. source-aware Rehab V1 scope pricing through the Evergreen Rehab Cost Book;
5. durable `rehab` phase persistence.

The next engineering phase is **MAO/pricing**, followed by full flip economics, DealCheck preparation, and final review persistence. A successful CashValue + Rehab is still **not** a completed underwriting recommendation and must not move the task to `review`, `approved`, or `done`.

## Production acceptance sequence

Do not perform synthetic underwriting smoke tests with fake comps, fake repair scope, or invented cost-book rates.

When the hosted Cash wildcard/dynamic-discovery configuration, HighLevel workflow trigger, and an approved Rehab Cost Book are ready:

1. confirm Cash resolves as slug `cash` through its existing credential;
2. move one controlled real SFR opportunity into the approved HighLevel `Underwriting` stage;
3. verify one Cash work item and one Agent Task are created/reopened;
4. run the isolated Cash automation against that real work item;
5. verify CashValue uses only real/source-backed sold evidence and persists a successful `cash_value` step;
6. verify Rehab uses only real/source-backed repair evidence and the approved cost book, then persists `rehab`;
7. confirm the same active work item resumes on subsequent turns rather than duplicating work;
8. confirm the task remains `in_progress` with next phase `mao` until MAO/pricing is implemented.
