# Cash Hourly Underwriting Automation

## Decision

Cash's recurring SFR underwriting pickup belongs in **OpenClaw Automations**. HighLevel remains the human/business-state authority; Agent Gateway / Supabase remains the execution, persistence, policy, rate-limit, and audit authority.

The SFR flow is now **activation-signal driven and just-in-time**:

```text
HighLevel opportunity enters SFR / Underwriting
        ↓
signed/authenticated stage webhook
        ↓
pending cash_activation_signal
        ↓
Cash calls underwriting_next_work_item
        ↓
Gateway re-reads LIVE HighLevel
        ↓
exact SFR pipeline + exact Underwriting stage + open + Single Family Residence?
        ↓
NO → signal stale; continue
YES → create/reuse durable Cash work item + task, lease it, persist live evidence
        ↓
CashValue → Acquisition Rehab → server MAO → Human Review
```

A stage webhook is an **activation signal**, not proof that a deal should still be underwritten later. The live HighLevel read immediately before claim is the final eligibility check.

## Cadence and runtime

The automation may wake on the existing recurring cadence, but the cadence is **not a one-deal throughput limit**.

Use an isolated Cash session and one recurring Cash worker. Do not configure a second generic Cash heartbeat that polls the same work source.

A production run should drain eligible work until one of these stop conditions is reached:

- `underwriting_next_work_item` returns no work;
- the run is approaching its configured runtime limit;
- a server-side provider/rate/credit budget is exhausted;
- an unexpected infrastructure/provider failure makes continued execution unsafe.

A deal-specific `needs_info` result blocks only that activation and must **not** stop Cash from asking for the next work item.

## Hosted MCP namespace policy

Cash keeps one stable authenticated MCP connection: `cash-gateway` using Cash's own credential.

Current Cash underwriting tools are:

- `cash-gateway__system_whoami`
- `cash-gateway__underwriting_next_work_item`
- `cash-gateway__underwriting_cash_value`
- `cash-gateway__underwriting_rehab`

MAO is calculated automatically server-side after successful Acquisition Rehab. Cash does not receive a caller-controlled MAO tool or broad HighLevel/database capability.

## Production duty cycle

Each automation turn should:

1. Call `system_whoami` and require agent slug `cash`.
2. Call `underwriting_next_work_item` with no routing arguments.
3. If no work item is returned, end with `NO_REPLY`.
4. Use only the server-issued opportunity/candidate/work identity and completed phases.
5. If CashValue has not succeeded, call `underwriting_cash_value` using the persisted opportunity identity.
6. Never fabricate comps or substitute an AVM for sold-comp CashValue.
7. If CashValue returns `needs_info`, do not advance that deal to Rehab. The backend blocks/releases the current activation; immediately ask for the next work item.
8. After successful CashValue, call `underwriting_rehab` using the active opportunity ID. Pass optional scope items only for specifically known source-backed major repairs.
9. If condition is absent, allow the approved Medium / Low-confidence policy default. Do not invent repair facts.
10. If Rehab returns `needs_info`, do not advance that deal. The backend blocks/releases the current activation; immediately ask for the next work item.
11. When Rehab succeeds, the Gateway automatically calculates and persists Standard MAO and the human-review stretch ceiling.
12. Successful MAO moves the durable Cash work item/task to `review` with `next_phase='human_review'`.
13. Ask `underwriting_next_work_item` again and continue while runtime/provider budgets allow.
14. Do **not** automatically run Flip Analysis, DealCheck, financing, detailed carrying-cost modeling, or contractor-grade Rehab after MAO.
15. Do not send offers, move HighLevel stages, approve a deal, or autonomously price above Standard MAO.

## `needs_info` disposition

For the current SFR activation, durable `needs_info` in either `cash_value` or `rehab` is a blocking disposition:

```text
cash_underwriting_steps.status = needs_info
        ↓
cash_work_items.state = blocked
lease cleared
Cash task = blocked
current activation signal = stale with phase-specific reason
        ↓
next Cash poll continues to another activation
```

This prevents queue-draining runs from spinning on the same incomplete deal. A genuine later HighLevel re-entry into Underwriting creates a newer `activation_count` and may reopen the same durable envelope.

## DealMachine efficiency boundary

When a fresh DealMachine subject-property snapshot exists, reuse it and normally make only the comps request. If no fresh snapshot exists, the normal maximum for a new subject is one comprehensive property enrichment plus one closed-comps request. Property enrichment remains property-only (`contact_audience='none'`).

DealMachine estimated value is reference-only and must never substitute for CashValue sold comps.

## Acquisition Rehab boundary

Acquisition Rehab is a preliminary whole-property underwriting allowance, not contractor-grade scope pricing. The approved classes remain Lipstick, Light Rehab, Medium Rehab, Heavy Rehab, and Full Reno.

The Gateway owns class $/sf bands, minimum floors, known-system adders, and contingency. If usable condition information is absent, policy defaults to Medium Rehab / Low confidence and uses the conservative high side for MAO.

## Queue / discovery behavior

`underwriting_next_work_item` is deliberately narrow:

- accepts no caller-controlled deal routing;
- first heals or disposes any prior active `needs_info` activation;
- revalidates resumable active work against live HighLevel before leasing it;
- otherwise reads pending SFR activation signals;
- collapses superseded activations;
- re-reads the exact opportunity from live HighLevel;
- requires exact SFR pipeline, exact Underwriting stage, `open` status, and `Single Family Residence`;
- creates/reuses durable work only after that live check;
- uses leases/advisory locking so concurrent Cash turns cannot work the same opportunity;
- ignores legacy queued rows as a discovery source.

Manual-GHL SFRs may legitimately have `candidate_id = null`. Ema-originated SFRs retain candidate/source-document provenance.

## Current completion boundary

Cash's autonomous SFR acquisition runtime is complete at:

1. source-backed CashValue;
2. Acquisition Rehab;
3. automatic Standard MAO plus human-review stretch ceiling;
4. CRM underwriting note with exact selected comps;
5. durable work/task transition to `review` / Human Review.

Flip Analysis, detailed insurance/carrying costs, financing, DealCheck, and contractor-grade Rehab remain later-stage workflows.

## Production acceptance

Acceptance must use the **real hosted Cash agent**, not an assistant-side queue claim.

Verify all of the following:

- an old activation whose opportunity is no longer live/eligible is made stale without DealMachine underwriting;
- a current open SFR opportunity in the exact Underwriting stage is JIT-claimed;
- no duplicate claim occurs under concurrent/repeated polling;
- CashValue uses real sold comps and persists exact selected comps;
- Rehab and server-side MAO complete to Human Review;
- a `needs_info` deal becomes blocked/released and does not prevent the worker from continuing;
- repeated polling does not repeat an already completed activation;
- a genuine later stage re-entry receives a new activation count;
- no automatic Flip/DealCheck run, offer send, or CRM stage move occurs.