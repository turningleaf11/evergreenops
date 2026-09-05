#!/usr/bin/env bash
#
# Agent task claim/result RPC tests.
#
# Runs 20260905193000_agent_task_claim_rpcs.sql against a throwaway Postgres and
# exercises the guards, including the concurrency case the design exists for:
# overlapping cron heartbeats must never be handed the same task.
#
#   ./supabase/tests/run-agent-task-rpc-tests.sh
#
# Requires postgres 16 binaries on PATH and a non-root user to run initdb.

set -euo pipefail
cd "$(dirname "$0")/../.."

PORT=${PORT:-55434}
SOCK=${SOCK:-/var/tmp}
DATA=${DATA:-/var/tmp/pgval-rpc}
MIGRATION=supabase/migrations/20260905193000_agent_task_claim_rpcs.sql
WS=11111111-1111-1111-1111-111111111111

psql -h "$SOCK" -p "$PORT" -U postgres -q -c "drop schema public cascade; create schema public;" >/dev/null 2>&1
psql -h "$SOCK" -p "$PORT" -U postgres -q -v ON_ERROR_STOP=1 -f supabase/tests/agent_task_rpc_fixture.sql
psql -h "$SOCK" -p "$PORT" -U postgres -q -v ON_ERROR_STOP=1 -f "$MIGRATION" 2>&1 | grep -v NOTICE || true

echo "=== behavioral guards ==="
psql -h "$SOCK" -p "$PORT" -U postgres -f supabase/tests/agent_task_rpc_guards.sql 2>&1 \
  | sed 's/^psql:[^ ]*: //' | grep -vE "^(INSERT|UPDATE|SET|Pager)"

echo
echo "=== concurrency: 8 simultaneous claims must return 8 distinct tasks ==="
psql -h "$SOCK" -p "$PORT" -U postgres -q -c "drop schema public cascade; create schema public;" >/dev/null
psql -h "$SOCK" -p "$PORT" -U postgres -q -f supabase/tests/agent_task_rpc_fixture.sql
psql -h "$SOCK" -p "$PORT" -U postgres -q -f "$MIGRATION" 2>&1 | grep -v NOTICE || true
psql -h "$SOCK" -p "$PORT" -U postgres -q <<SQL
insert into workspaces (id) values ('$WS');
insert into agents (name, slug, emoji) values ('Marquetta','marquetta','🎯');
insert into agent_tasks (title, assigned_to, status, priority, workspace_id)
select 'task-'||g, 'marquetta', 'todo', 'high', '$WS' from generate_series(1,8) g;
SQL

claims=$(mktemp)
for _ in $(seq 1 8); do
  psql -h "$SOCK" -p "$PORT" -U postgres -tAc \
    "select title from agent_task_claim_next('marquetta','$WS')" >> "$claims" 2>&1 &
done
wait

distinct=$(sort -u "$claims" | grep -c 'task-' || true)
dupes=$(sort "$claims" | uniq -d | grep -c 'task-' || true)
rm -f "$claims"

echo "  distinct tasks claimed: $distinct of 8"
echo "  duplicates:             $dupes (must be 0)"
if [[ "$distinct" == "8" && "$dupes" == "0" ]]; then
  echo "  PASS"
else
  echo "  FAIL — overlapping claims collided"; exit 1
fi
