# DealMachine Provider Boundary

## Decision

DealMachine is Evergreen's primary paid property-data and SFR comparable-sales provider.

Cash does not receive a DealMachine credential or direct DealMachine MCP/API connection. Production access remains server-side:

`Cash -> Agent Gateway -> Evergreen DealMachine adapter -> DealMachine v2 API`

The adapter reads `DEALMACHINE_API_KEY` from protected server configuration. The raw key must never be returned to an agent, persisted in underwriting output, or logged.

## CashValue provider order

For SFR CashValue, the provider/evidence order is:

1. **DealMachine** — primary subject-property enrichment and comparable-sales search.
2. **RentCast** — fallback only when configured and DealMachine does not supply the minimum comp set.
3. **Source-backed public evidence** — independently sourced subject facts and sold comps with source references.
4. **Zillow/other AVMs** — supporting valuation references only when approved/configured; never fabricated sold-comp evidence.

DealMachine's estimated value is a supporting valuation reference. Evergreen CashValue remains calculated from defensible closed sold comps that pass Evergreen's own property-type, distance, square-footage, recency, and other comp rules.

If only one or two defensible sold comps remain, Cash must return the thin comp set and low-confidence CashValue rather than inventing replacements. If zero defensible sold comps remain, an AVM or estimated value does not become CashValue.

## DealMachine comp request boundary

The server-side DealMachine comps request must:

- match the subject property type;
- use a 1-mile radius for the current SFR policy;
- start at a 6-month sale timeframe and expand to 12 months only when the initial set is thin;
- exclude active listings from the CashValue comp sample;
- exclude pending sales;
- exclude foreclosure sales by default;
- request a bounded result set;
- still pass every returned sale through Evergreen's own deterministic CashValue eligibility/scoring logic.

A provider-side match score is discovery/ranking evidence, not authority to bypass Evergreen's comp policy.

## Credit control

CashValue property enrichment uses `contact_audience: none`. Cash does not need owner/relative contact enrichment to value a property, so the underwriting path must not consume people credits.

DealMachine property IDs and sanitized credit/request metadata may be persisted for provenance and cost monitoring. Credentials and Authorization headers must never be persisted.

## Lead enrichment direction

The shared DealMachine adapter is also the foundation for lead enrichment. Lead enrichment should remain separate from Cash's underwriting authority.

Property-only enrichment should be the default first pass and may include, when supported by the active DealMachine field catalog:

- building characteristics and property type;
- living area, beds/baths, year built, stories and construction details;
- assessor/tax information;
- HOA information;
- flood information;
- mortgage/equity information;
- sale history and MLS information;
- liens and pre-foreclosure signals;
- lot, systems/utilities, condition/quality and amenities.

Owner/contact enrichment should be requested only by an approved lead-generation workflow that actually needs it. It must not be bundled into every property lookup simply because contacts are available.

The legacy `sync-dealmachine` Edge Function predates the current DealMachine v2 API and is not the architectural source of truth for new integration work. Modernization should reuse the shared v2 adapter and migrate deliberately rather than extending old `/public/v1` assumptions.
