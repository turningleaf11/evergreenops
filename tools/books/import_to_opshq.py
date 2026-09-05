#!/usr/bin/env python3
"""Emit SQL to load the Mercury CSVs into book_transactions.

external_id is a deterministic hash of the fields Mercury actually guarantees,
so re-running an import can never duplicate a row.
"""
import csv, hashlib, json, re, sys
from pathlib import Path

WS = 'a8938ed0-9c4e-4d42-b874-593b4b3c90a9'
ACC = json.loads(Path('accounts.json').read_text())['accounts']
L4 = re.compile(r'xx(\d{4})')

rows = []
for f in sorted(Path('data').glob('*.csv')):
    for r in csv.DictReader(f.open(encoding='utf-8-sig')):
        if not r.get('Date (UTC)'):
            continue
        m = L4.search(r.get('Source Account', ''))
        if not m or m.group(1) not in ACC:
            continue
        last4 = m.group(1)
        d, desc = r['Date (UTC)'], (r.get('Description') or '').strip()
        amt = r['Amount']
        ts = r.get('Timestamp', '')
        # Mercury gives no stable id, so derive one from what it does guarantee.
        ext = hashlib.sha1(f'{d}|{desc}|{amt}|{last4}|{ts}'.encode()).hexdigest()[:32]
        failed = r.get('Status') == 'Failed'
        rows.append({
            'last4': last4,
            'date': f"{d[6:10]}-{d[0:2]}-{d[3:5]}",
            'desc': desc[:200],
            'bank': (r.get('Bank Description') or '').replace('\n', ' ').strip()[:200],
            'memo': ((r.get('Note') or r.get('Reference') or '')).replace('\n', ' ').strip()[:200],
            'amt': amt,
            'status': 'failed' if failed else 'posted',
            'fail': (r.get('Failure Reason') or '')[:200] if failed else None,
            'ext': ext,
        })

def q(s):
    return 'null' if s is None else "'" + str(s).replace("'", "''") + "'"

CHUNK = int(sys.argv[1]) if len(sys.argv) > 1 else 260
out = Path('out'); out.mkdir(exist_ok=True)
for i in range(0, len(rows), CHUNK):
    part = rows[i:i + CHUNK]
    vals = ",\n".join(
        f"({q(r['last4'])},{q(r['date'])}::date,{q(r['desc'])},{q(r['bank'])},{q(r['memo'])},"
        f"{r['amt']}::numeric,{q(r['status'])},{q(r['fail'])},{q(r['ext'])})" for r in part)
    sql = f"""insert into book_transactions
  (workspace_id, bank_account_id, entity_id, txn_date, description, bank_description, memo, amount, status, failure_reason, external_id)
select '{WS}'::uuid, ba.id, ba.entity_id, v.d, v.descr, v.bankd, nullif(v.memo,''), v.amt, v.st, v.fail, v.ext
from (values
{vals}
) as v(last4, d, descr, bankd, memo, amt, st, fail, ext)
join book_bank_accounts ba on ba.last_four = v.last4 and ba.workspace_id = '{WS}'::uuid
on conflict (workspace_id, bank_account_id, external_id) do nothing;"""
    (out / f"import_{i//CHUNK+1:02d}.sql").write_text(sql)

print(f"rows={len(rows)}  files={(len(rows)+CHUNK-1)//CHUNK}")
for p in sorted(out.glob('import_*.sql')):
    print(f"  {p.name}  {p.stat().st_size//1024}KB")
