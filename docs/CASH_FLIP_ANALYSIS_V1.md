# Cash Flip Analysis V1

Cash Flip Analysis V1 is the deterministic **unlevered project-economics** phase that follows successful CashValue, Rehab, and MAO for an SFR underwriting activation.

## Phase order

```text
CashValue -> Rehab -> MAO -> Flip Analysis -> DealCheck -> Final Review
```

Only durable `status='succeeded'` phases count as complete. A missing or incomplete Flip Analysis policy persists `phase='flip_analysis'`, `status='needs_info'` and remains the current phase.

## Pricing scenarios

Flip Analysis calculates two scenarios from the already-persisted MAO result:

- **Standard:** purchase price = Evergreen standard MAO (currently 65% of CashValue less Rehab).
- **Stretch:** purchase price = Evergreen stretch ceiling (currently 68% of CashValue less Rehab).

The stretch scenario is informational and requires human approval. It is not a second default MAO and does not authorize Cash to price above the standard MAO.

## Inputs inherited from prior phases

Flip Analysis does not accept model-supplied ARV, Rehab, MAO, or stretch values. The backend loads, for the same active work-item activation:

- successful CashValue -> modeled sale value;
- successful Rehab base total including contingency -> rehab cost;
- successful MAO -> standard MAO and stretch ceiling.

## Versioned Flip Analysis policy

Project-cost assumptions come only from one active workspace-scoped `flip_analysis_policies` row. V1 requires explicit values for:

- acquisition closing cost percentage;
- sale cost percentage;
- hold months;
- monthly property taxes;
- monthly insurance;
- monthly utilities;
- monthly maintenance;
- monthly HOA;
- monthly other carrying cost;
- policy `source_reference` provenance.

An explicit zero is valid. A missing value is not treated as zero. If the active policy is absent or incomplete, the phase returns `needs_info` and does not calculate profit or return metrics.

No policy values are seeded by the V1 migration.

## V1 calculations

For each scenario:

```text
Acquisition Closing Costs = Purchase Price * Acquisition Closing Cost %
Monthly Carry = Taxes + Insurance + Utilities + Maintenance + HOA + Other
Total Carry = Monthly Carry * Hold Months
Sale Costs = CashValue * Sale Cost %
Net Sale Proceeds = CashValue - Sale Costs
Total Project Cost = Purchase Price + Acquisition Closing Costs + Rehab + Total Carry
Net Profit = Net Sale Proceeds - Total Project Cost
Return on Cost = Net Profit / Total Project Cost
Profit Margin on Sale = Net Profit / CashValue
Break-even Sale Price = Total Project Cost / (1 - Sale Cost %)
```

The output also reports the reduction in expected profit between the standard and stretch purchase scenarios.

## Deliberately excluded from V1

Financing is not hidden inside project economics. V1 excludes:

- loan amount / LTV;
- down payment;
- interest rate;
- points and lender fees;
- debt service / amortization;
- remaining loan payoff;
- assignment fee defaults;
- marketing fee defaults.

Financing belongs in a later capital-stack / levered-return layer. Deal-specific assignment or marketing costs may be added later through a source-backed, approved cost-input path.

## ARVA boundary

ARVA is a human workstation and may contain editable UI defaults. Those defaults are **not Evergreen underwriting policy** unless they are deliberately promoted into an approved backend policy.

In particular, V1 does not inherit ARVA's legacy defaults such as 9-month hold, 3% buy costs, 8% sale costs, $1,500 monthly hold, $15,000 assignment fee, or the legacy 70% MAO display.

## Autonomous boundary

Flip Analysis is server-side and has no separate model-facing MCP action. After MAO succeeds, the backend evaluates Flip Analysis automatically. Cash cannot alter the policy assumptions through tool arguments.

The phase is analysis for human review; it is not authority to send an offer, accept terms, borrow funds, or transact.
