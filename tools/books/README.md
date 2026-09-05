# Mercury books categorizer

Turns raw Mercury CSV exports into per-entity ledgers, draft P&Ls, and — the
part that matters — an exceptions file of everything it refuses to guess at.

Built to get TY2025 books to the CPA. It is **not** a bookkeeping product and
must not become one.

## Run

    cp <mercury exports>.csv data/
    python3 categorize.py          # writes out/

## Files

| File | Purpose |
|---|---|
| `accounts.json` | Mercury account (by last 4) -> entity. The foundation — everything depends on this being right. |
| `rules.json` | Deterministic payee rules. First match wins. |
| `categorize.py` | The engine. |

## Design

Roughly 70% of rows resolve on deterministic rules, not AI: internal transfers,
intercompany movements, partner draws, and known payees. A classifier is only
worth adding for the messy merchant tail once the volume justifies it.

Three treatments decide where a row lands:

- `pl` — hits the profit & loss
- `equity` / `intercompany` / `transfer` — excluded from P&L, but **not discarded**;
  intercompany rows need due-to/due-from entries on *both* entities' balance sheets
- `exception` — never auto-decided, always routed to a human

**`org` is not `entity`.** An account can physically live under one Mercury
organization while the money belongs to another entity — the 1109 Riviera
accounts sit under Evergreen Creative because EC was trustee. Conflating the two
puts income on the wrong return.

## Known limits

- Earnest money, mortgage principal/interest splits, and property dispositions
  are deliberately routed to exceptions. They need source documents (Form 1098,
  closing statements), not a rule.
- Failed/declined transactions are excluded from all totals and listed in
  `out/_failed_transactions.csv`.
- Nothing here is tax advice or filing-ready. A licensed preparer reviews it.
