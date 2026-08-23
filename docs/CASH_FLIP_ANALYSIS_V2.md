# Cash Flip Analysis V2

Cash Flip Analysis V2 keeps the SFR flip engine deterministic and unlevered while separating **deal-specific carrying facts** from **Evergreen policy assumptions**.

## Phase order

```text
CashValue -> Rehab -> MAO -> Flip Analysis -> DealCheck -> Final Review
```

A phase advances only when its durable underwriting step has `status='succeeded'`. Missing policy assumptions or missing deal-specific carrying facts persist `phase='flip_analysis'`, `status='needs_info'`.

## Pricing scenarios

- **Standard:** purchase price = Evergreen standard MAO, currently `65% × CashValue - Rehab`.
- **Stretch:** purchase price = separate human-review ceiling, currently `68% × CashValue - Rehab`.

The stretch scenario never becomes the default MAO and never authorizes Cash to price above the standard MAO.

## Deal-specific carrying facts

These costs vary materially property by property and are therefore **not** fixed South Florida policy defaults:

- property taxes;
- insurance;
- HOA.

The runtime resolves them from subject-specific evidence. Current supported sources include:

- RentCast public-record property-tax history;
- RentCast monthly HOA fee when present;
- source-backed candidate facts, retained as `source_claim` rather than silently promoted to verified fact;
- explicit confirmed no-HOA evidence, represented as a true zero.

Missing public-record fields remain unknown. Missing is never converted to zero.

Insurance is not provided by RentCast property records. Until an approved insurance source/estimator is integrated, insurance must come from a deal-specific source claim/verified input or Flip Analysis remains `needs_info`.

Each property-specific carrying fact persists provenance/evidence class alongside the modeled dollar amount.

## Evergreen Flip Policy assumptions

One active workspace-scoped `flip_analysis_policies` row supplies only the assumptions that legitimately belong to policy:

- acquisition closing cost percentage;
- sale cost percentage;
- hold months;
- monthly utilities;
- monthly maintenance;
- monthly miscellaneous carrying cost;
- policy `source_reference` provenance.

Legacy columns for fixed monthly property taxes, insurance, and HOA are not used by the V2 engine.

## V2 calculations

For each scenario:

```text
Acquisition Closing Costs = Purchase Price × Acquisition Closing Cost %
Monthly Carry = Deal Taxes + Deal Insurance + Policy Utilities + Policy Maintenance + Deal HOA + Policy Other
Total Carry = Monthly Carry × Hold Months
Sale Costs = CashValue × Sale Cost %
Net Sale Proceeds = CashValue - Sale Costs
Total Project Cost = Purchase Price + Acquisition Closing Costs + Rehab + Total Carry
Net Profit = Net Sale Proceeds - Total Project Cost
Return on Cost = Net Profit / Total Project Cost
Profit Margin on Sale = Net Profit / CashValue
Break-even Sale Price = Total Project Cost / (1 - Sale Cost %)
```

## Deliberately excluded

V2 remains unlevered. It does not assume:

- loan amount / LTV;
- down payment;
- interest rate;
- points or lender fees;
- debt service or amortization;
- assignment-fee defaults;
- marketing-fee defaults.

Financing belongs in a later capital-stack / levered-return layer. Deal-specific assignment or marketing costs require a separate source-backed approved cost-input path.

## ARVA boundary

ARVA UI defaults are not Evergreen backend policy. In particular, the runtime does not inherit the legacy 9-month hold, 3% acquisition costs, 8% sale costs, $1,500 monthly carry, $15,000 assignment fee, or the retired 70% MAO display unless a value is deliberately adopted into approved backend policy.

## Automation boundary

Flip Analysis remains server-side after MAO. Cash cannot provide ARV, Rehab, MAO multipliers, carrying-dollar defaults, or pricing formulas through model-facing tool arguments.
