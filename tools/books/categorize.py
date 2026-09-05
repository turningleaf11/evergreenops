#!/usr/bin/env python3
"""
Mercury transaction categorizer.

Reads raw Mercury CSV exports, resolves every account to an entity, strips
internal transfers, applies deterministic payee rules, and routes everything
it will not guess at into an exceptions file.

The exceptions file is the point. A P&L with no exceptions list is a P&L that
lied to you confidently.

Usage:  python3 categorize.py
"""
import csv, json, re, sys
from pathlib import Path
from collections import defaultdict
from decimal import Decimal

HERE = Path(__file__).parent
DATA, OUT = HERE / "data", HERE / "out"

cfg = json.loads((HERE / "accounts.json").read_text())
ACCOUNTS, ENTITIES = cfg["accounts"], cfg["entities"]
RULES = json.loads((HERE / "rules.json").read_text())["rules"]

LAST4 = re.compile(r"xx(\d{4})")


def entity_of(last4):
    return ACCOUNTS.get(last4, {}).get("entity", "UNKNOWN")


def source_last4(row):
    """Which account is this transaction ON."""
    m = LAST4.search(row.get("Source Account", ""))
    return m.group(1) if m else None


def counterparty_last4(row):
    """Which account did the money move to/from, when it's another Mercury account."""
    for field in ("Description", "Bank Description"):
        m = LAST4.search(row.get(field, ""))
        if m:
            return m.group(1)
    return None


def classify(row, src_entity):
    """Return (account, treatment, note). Deterministic rules only."""
    desc = f"{row.get('Description','')} {row.get('Bank Description','')}"

    cp = counterparty_last4(row)
    if cp:
        cp_entity = entity_of(cp)
        cp_name = ACCOUNTS.get(cp, {}).get("name", f"xx{cp}")
        if cp_entity == "UNKNOWN":
            return ("UNMAPPED ACCOUNT", "exception",
                    f"Moved to/from {cp_name} (xx{cp}) which is not in accounts.json. "
                    f"Identify this account before trusting any total.")
        if cp_entity == src_entity:
            return (f"Internal transfer -> {cp_name}", "transfer", "")
        return (f"9000 Intercompany -> {ENTITIES[cp_entity]['label']}", "intercompany",
                "Excluded from P&L. Needs a due-to/due-from entry on BOTH entities' balance sheets.")

    # Transfers Mercury describes but doesn't give an account number for
    bank = row.get("Bank Description", "")
    if "Transfer between your Mercury accounts" in bank or "another bank account" in bank:
        return ("UNTRACEABLE TRANSFER", "exception",
                "Mercury calls this a transfer but names no counterparty account. "
                "Match it by hand against the other side.")

    for rule in RULES:
        if re.search(rule["match"], desc, re.I):
            return (rule["account"], rule["treatment"], rule.get("note", ""))

    return ("UNCATEGORIZED", "exception", "No rule matched. Needs a human or a classifier pass.")


def main():
    OUT.mkdir(exist_ok=True)
    rows, failed = [], []

    for path in sorted(DATA.glob("*.csv")):
        with path.open(newline="", encoding="utf-8-sig") as fh:
            for raw in csv.DictReader(fh):
                if not raw.get("Date (UTC)"):
                    continue
                src = source_last4(raw)
                if src is None:
                    continue
                amount = Decimal(raw["Amount"] or "0")
                src_entity = entity_of(src)

                rec = {
                    "date": raw["Date (UTC)"],
                    "entity": src_entity,
                    "account_held_at": ACCOUNTS.get(src, {}).get("name", f"xx{src}"),
                    "mercury_org": ACCOUNTS.get(src, {}).get("org", "UNKNOWN"),
                    "description": raw["Description"],
                    "amount": amount,
                    "source_file": path.name,
                    "mercury_guess": raw.get("Category", ""),
                    "memo": (raw.get("Note") or raw.get("Reference") or "").replace("\n", " ").strip(),
                }

                if raw.get("Status") == "Failed":
                    rec["failure"] = raw.get("Failure Reason", "")
                    failed.append(rec)
                    continue

                acct, treat, note = classify(raw, src_entity)
                rec.update(account=acct, treatment=treat, note=note)
                rows.append(rec)

    # ---- write per-entity output -------------------------------------------
    by_entity = defaultdict(list)
    for r in rows:
        by_entity[r["entity"]].append(r)

    summary = {}
    for entity, recs in sorted(by_entity.items()):
        label = ENTITIES.get(entity, {}).get("label", entity)
        slug = entity

        ledger = sorted(recs, key=lambda r: r["date"])
        _write(OUT / f"{slug}__ledger.csv", ledger,
               ["date", "account_held_at", "description", "amount", "account",
                "treatment", "note", "memo", "mercury_guess", "mercury_org", "source_file"])

        exc = [r for r in ledger if r["treatment"] == "exception"]
        _write(OUT / f"{slug}__exceptions.csv", exc,
               ["date", "account_held_at", "description", "amount", "account", "note", "memo"])

        # P&L: only treatment == pl
        pl = defaultdict(Decimal)
        for r in ledger:
            if r["treatment"] == "pl":
                pl[r["account"]] += r["amount"]

        with (OUT / f"{slug}__pl.csv").open("w", newline="") as fh:
            w = csv.writer(fh)
            w.writerow([label, "TY2025 - DRAFT, NOT FILING-READY"])
            w.writerow([])
            w.writerow(["Account", "Amount"])
            income = {k: v for k, v in pl.items() if v > 0}
            expense = {k: v for k, v in pl.items() if v <= 0}
            for k in sorted(income):
                w.writerow([k, f"{income[k]:.2f}"])
            w.writerow(["TOTAL INCOME", f"{sum(income.values()):.2f}"])
            w.writerow([])
            for k in sorted(expense):
                w.writerow([k, f"{expense[k]:.2f}"])
            w.writerow(["TOTAL EXPENSE", f"{sum(expense.values()):.2f}"])
            w.writerow([])
            w.writerow(["NET (P&L rows only)", f"{sum(pl.values()):.2f}"])
            w.writerow([])
            w.writerow(["*** UNRESOLVED EXCEPTIONS", len(exc)])
            w.writerow(["*** This P&L is incomplete until those are cleared."])

        counts = defaultdict(int)
        amts = defaultdict(Decimal)
        for r in ledger:
            counts[r["treatment"]] += 1
            amts[r["treatment"]] += r["amount"]
        summary[label] = {
            "rows": len(ledger), "exceptions": len(exc),
            "by_treatment": {k: (counts[k], f"{amts[k]:.2f}") for k in sorted(counts)},
            "pl_net": f"{sum(pl.values()):.2f}",
        }

    _write(OUT / "_failed_transactions.csv", failed,
           ["date", "entity", "account_held_at", "description", "amount", "failure"])

    # ---- console report ----------------------------------------------------
    print("=" * 74)
    print("CATEGORIZER RUN - TY2025 DRAFT")
    print("=" * 74)
    for label, s in summary.items():
        print(f"\n{label}")
        print(f"  rows {s['rows']:>4}   exceptions {s['exceptions']:>3}   P&L net {s['pl_net']:>14}")
        for t, (n, a) in s["by_treatment"].items():
            print(f"     {t:<14} {n:>4} rows   {a:>14}")
    print(f"\nFailed/declined transactions excluded: {len(failed)}")
    print(f"\nOutput -> {OUT}")


def _write(path, recs, fields):
    with path.open("w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=fields, extrasaction="ignore")
        w.writeheader()
        for r in recs:
            w.writerow({k: (f"{r[k]:.2f}" if k == "amount" else r.get(k, "")) for k in fields})


if __name__ == "__main__":
    main()
