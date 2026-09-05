# Marquetta content engine — migration regression tests

These verify that `20260905180000_marquetta_content_engine.sql` actually enforces
Marquetta's limits at the database level, rather than only in her skill prompt.
Written after the Cash lesson that an assumed data shape is not a verified one.

## Running

Needs a throwaway Postgres 16 (not the production project):

```bash
initdb -D /var/tmp/pgval/data -U postgres --auth=trust
pg_ctl -D /var/tmp/pgval/data -o '-p 55433 -k /var/tmp' -l /var/tmp/pgval/log start

psql -h /var/tmp -p 55433 -U postgres -v ON_ERROR_STOP=1 -f supabase/tests/fixture.sql
psql -h /var/tmp -p 55433 -U postgres -v ON_ERROR_STOP=1 -f supabase/tests/seed.sql
psql -h /var/tmp -p 55433 -U postgres -v ON_ERROR_STOP=1 \
  -f supabase/migrations/20260905180000_marquetta_content_engine.sql
psql -h /var/tmp -p 55433 -U postgres -f supabase/tests/guards.sql
```

`fixture.sql` mirrors the production shape of the tables the migration touches.
`seed.sql` reproduces the real triplicated brand state — three users, three
brands each, one workspace.

## What must hold

| # | Guard | Expected |
|---|---|---|
| 1 | Dedupe keeps one row per (workspace, name) | 3 brands remain from 9 |
| 2 | Unique index prevents re-triplication | insert ERRORs |
| 3 | Workspace RLS shows a user another user's brands | 3 visible (0 under the old owner-scoped policy) |
| 4 | `content_library` accepts `review`, rejects unknown status | insert ok / ERROR |
| 5 | Approved voice exemplar cannot be edited | update ERRORs |
| 5b | ...but can still be demoted by a human | UPDATE 1 |
| 6 | Repeat capture of the same source event is rejected | insert ERRORs |
| 7 | Unknown schedule status rejected | insert ERRORs |

Guard 3 is the one to re-check if the dedupe is ever re-run: the surviving rows
belong to a single user, so **the dedupe and the RLS change must ship together**.
Deduping alone would leave every other member of the workspace with an empty
Content Studio.
