# Cash Hourly Underwriting Automation

## Decision

Cash's recurring underwriting pickup belongs in **OpenClaw Automations**, not Supabase Cron and not a generic free-form heartbeat.

- **HighLevel stage change** is the human activation authority and creates/reopens the durable Cash work item.
- **OpenClaw Automation** owns *when Cash gets an agent turn* to claim pending work.
- **Agent Gateway / Supabase** owns authentication, queue claiming, persistence, idempotency, exact action permissions, rate limits, underwriting policy, and audit history.

The automation is a recovery/pickup mechanism. It must not create a second underwriting authority or bypass the HighLevel stage trigger.

## Cadence

Production default: **every 1 hour**, 24/7.

Use an isolated Cash session. Do not configure a second generic Cash heartbeat to poll the same underwriting queue while this automation is enabled.

## Hosted MCP namespace policy

Cash keeps one stable authenticated MCP connection: `cash-gateway` using Cash's own credential.

Preferred hosted filtering:

- allow `cash-gateway__*` for the existing Cash agent;
- do not attach or reuse Ema's credential;
- rely on Supabase `agent_permissions` as the authoritative exact action allowlist.

A hosted namespace wildcard does **not** grant backend authorization. Every Gateway request still resolves Cash's authenticated identity and must pass exact action permission, rate limit, validation, and audit boundaries.

Current Cash underwriting tools exposed through the Gateway are:

- `cash-gateway__system_whoami`
- `cash-gateway__underwriting_next_work_item`
- `cash-gateway__underwriting_cash_value`
- `cash-gateway__underwriting_rehab`

MAO is calculated automatically server-side after successful Acquisition Rehab; Cash does not receive a caller-controlled MAO tool or pricing-input surface.

## Recommended OpenClaw job

Conceptually:

```bash
openclaw automations create "every 1h" \
  --name "Cash Hourly Underwriting" \
  --agent cash \
  --session isolated \
  --message "Run Cash's hourly acquisition-underwriting duty exactly as defined in the Cash skill. Verify identity, claim or resume the next approved SFR work item, establish CashValue from source-backed sold comps, run Acquisition Rehab using persisted condition evidence and approved policy, allow the Gateway to calculate MAO, and stop when the work item reaches human review. Never fabricate comps, repair facts, rates, or assumptions. Return NO_REPLY when there is no queued work or no human attention is required."
```

During burn-in, no-delivery is acceptable while run history is inspected. In production, route exception-only output to the owner/operator and return `NO_REPLY` for clean/no-work runs.

## Current SFR duty cycle

Each hourly run should:

1. Call `system_whoami` and require agent slug `cash`.
2. Call `underwriting_next_work_item` with no arguments.
3. If no SFR work item is available, return `NO_REPLY`.
4. If a work item is returned, use only its server-issued opportunity/candidate identity and successfully completed phases. Do not substitute a caller-selected deal.
5. If `cash_value` has not succeeded, call `underwriting_cash_value` using the persisted opportunity identity.
6. Let the Gateway use DealMachine first. Do not web-search for replacement comps before the approved provider capability is attempted, and never invent comps to satisfy sample count.
7. When a fresh DealMachine subject-property snapshot already exists, Cash should reuse it; the valuation path should normally require only the DealMachine comps call. If no snapshot exists, the Gateway may perform one comprehensive property-enrichment request plus one comps request and then cache the property result.
8. If CashValue returns `needs_info`, stop on that work item. Do not advance to Rehab.
9. After successful CashValue, call `underwriting_rehab` using the active opportunity ID. Detailed repair itemization is not required.
10. Pass optional `scope_items` only for specifically known source-backed major repairs. Cash never supplies Rehab rates, $/sf bands, minimums, or contingency.
11. If condition is absent, allow the approved Acquisition Rehab policy to use the conservative Medium / Low-confidence default rather than manufacturing repair facts.
12. If Rehab returns `needs_info`, stop on that work item.
13. When Rehab succeeds, the Gateway automatically calculates and persists MAO using the active 65% standard / 68% human-review stretch policy.
14. A successful MAO is the **current acquisition-underwriting completion point**. The backend moves the durable Cash work item and task to `review` and sets `next_phase='human_review'`.
15. Do **not** automatically run Flip Analysis, DealCheck, detailed insurance/carrying-cost modeling, or financing after MAO. Those are later-stage due-diligence workflows.
16. Do not send offers, move HighLevel stages, approve the deal, or price above Standard MAO.

## DealMachine call-efficiency boundary

Evergreen wants the most reusable subject information with the fewest practical provider calls.

### Fresh property snapshot already exists

Normal Cash provider pattern:

```text
Evergreen cached DealMachine subject facts
                  +
        one DealMachine comps call
```

Cash should reuse the persisted subject facts rather than refetching property data solely for valuation.

### No fresh property snapshot exists

Normal maximum provider pattern for a new subject:

```text
one comprehensive DealMachine property enrichment
                       +
one 12-month closed-comps request
```

The property request should retrieve supported property-only facts together, including useful tax/assessor data, property basics, last sale, MLS, mortgage/equity, liens, HOA amount when available, lot/zoning, systems/materials, flood, and condition fields. It uses `contact_audience='none'`; no people/contact enrichment belongs in CashValue.

The comps request returns one 12-month provider pool. Evergreen applies its normal 6-month criteria first and its 12-month expanded criteria locally, avoiding a second comps request just to widen recency.

DealMachine estimated value remains reference-only and must never substitute for CashValue sold comps.

## Acquisition Rehab boundary

Cash's current Rehab phase is **Acquisition Rehab**, not contractor-grade scope pricing.

Whole-property classes are:

- Lipstick
- Light Rehab
- Medium Rehab
- Heavy Rehab
- Full Reno

The Gateway owns the approved class $/sf bands, minimum floors, system adders, and contingency. Cash provides no pricing overrides.

If no usable condition information exists, the active policy defaults to **Medium Rehab / Low confidence** and uses the high side for MAO. This is clearly labeled as an underwriting assumption.

Detailed itemized rehab/cost-book analysis remains a later due-diligence workflow for photos, inspection, measurements, walkthrough, or contractor quotes.

## Queue behavior

`underwriting_next_work_item` is deliberately narrow:

- accepts no caller-controlled routing fields;
- resumes an already-active SFR item after an agent restart before claiming another;
- otherwise claims the oldest/highest-priority queued SFR item;
- does not claim Portfolio work until the Portfolio/Napkin engine exists;
- uses row locking so concurrent Cash turns cannot independently claim the same queued item;
- returns only successfully completed acquisition phases.

A work item already moved to `review` after MAO is no longer an active pickup target. The HighLevel stage trigger remains the normal way to create/reopen the work envelope.

## Current completion boundary

The autonomous SFR acquisition runtime implements:

1. work claim/resume;
2. source-backed DealMachine-first CashValue;
3. reusable DealMachine property snapshot persistence/caching;
4. Acquisition Rehab classification and deterministic pricing;
5. automatic Standard MAO and human-review stretch calculation;
6. CRM underwriting note with exact selected sold comps;
7. atomic transition of Cash task/work item to `review` after successful MAO.

Insurance, detailed property carrying costs, full Flip Analysis, financing, DealCheck, and contractor-grade rehab are **not required** before this acquisition-stage handoff.

## Production acceptance sequence

Do not perform synthetic underwriting smoke tests with fake comps or invented repair facts.

For a controlled real SFR deal:

1. confirm Cash resolves as slug `cash` through its existing credential;
2. move the opportunity into the approved HighLevel `Underwriting` stage;
3. verify exactly one Cash work item / Agent Task is created or reopened;
4. let Cash claim/resume that durable item;
5. verify CashValue uses real sold comps and persists the exact selected comps;
6. verify the DealMachine subject snapshot is either reused or fetched/persisted with zero people credits;
7. verify Acquisition Rehab uses source-backed condition when available or the explicit Medium/Low policy default when unknown;
8. verify MAO is calculated server-side from successful CashValue + Rehab;
9. verify Standard MAO remains the autonomous ceiling and the 68% stretch remains human-only;
10. verify the work item and Cash task end in `review` with `next_phase='human_review'`;
11. confirm no automatic Flip/DealCheck run is required to complete Cash's acquisition stage;
12. on a subsequent/new deal, verify the expected DealMachine call pattern: one comps call when a fresh property snapshot exists, otherwise one property call plus one comps call.
