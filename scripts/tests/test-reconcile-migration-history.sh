#!/usr/bin/env bash
#
# Tests for reconcile-migration-history.sh.
#
# The `supabase migration list` output shape is reproduced verbatim (backtick
# quoting, pipe separators, blank cells) so the awk parsing is exercised, not
# just the classification.
#
# The script calls `migration list` twice: once to classify, and once after
# repairing legacy versions to confirm the history is aligned. `migration
# repair` mutates the remote ledger between those calls, so the stub returns a
# queue of listings rather than a fixed one — a static stub would make a correct
# script look broken.

set -uo pipefail
cd "$(dirname "$0")/../.."

SCRIPT=scripts/reconcile-migration-history.sh
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
pass=0; fail=0

HEADER='        Local          | Remote         | Time (UTC)
  ----------------|----------------|---------------------'

# run_case <name> <expect_status> <expect_patterns...> -- <listing> [listing_after_repair]
run_case() {
  local name="$1" expect_status="$2"; shift 2
  local patterns=() listings=()
  while [[ "$1" != "--" ]]; do patterns+=("$1"); shift; done
  shift
  listings=("$@")

  rm -rf "$TMP/state"; mkdir -p "$TMP/state" "$TMP/migrations"
  local i=0
  for l in "${listings[@]}"; do
    printf '%s\n%s\n' "$HEADER" "$l" > "$TMP/state/listing.$i"; i=$((i+1))
  done

  # Stub: return the next listing each call, repeating the last one thereafter.
  cat > "$TMP/state/list.sh" <<STUB
#!/usr/bin/env bash
n=\$(cat "$TMP/state/calls" 2>/dev/null || echo 0)
echo \$((n+1)) > "$TMP/state/calls"
f="$TMP/state/listing.\$n"
[[ -f "\$f" ]] || f=\$(ls "$TMP/state"/listing.* | sort -V | tail -1)
cat "\$f"
STUB
  chmod +x "$TMP/state/list.sh"

  local out status ok=1
  out=$(LEGACY_CUTOFF=20260903223617 \
        MIGRATIONS_DIR="$TMP/migrations" \
        MIGRATION_LIST_CMD="$TMP/state/list.sh" \
        MIGRATION_REPAIR_CMD="echo REPAIRED" \
        bash "$SCRIPT" 2>&1)
  status=$?
  [[ "$status" == "$expect_status" ]] || ok=0
  for p in "${patterns[@]}"; do grep -qE "$p" <<<"$out" || ok=0; done

  if (( ok )); then
    echo "  PASS  $name"; pass=$((pass+1))
  else
    echo "  FAIL  $name (exit $status, expected $expect_status)"
    sed 's/^/          /' <<<"$out"; fail=$((fail+1))
  fi
}

echo "reconcile-migration-history.sh"

# The case the old workflow got wrong: a committed-but-unapplied migration was
# treated as fatal drift, which would block every new migration.
run_case "pending migration is allowed through" 0 \
  "1 pending migration" "20260905180000" -- \
"   20260903120000 | 20260903120000 | 2026-09-03 12:00:00
   20260905180000 |                | 2026-09-05 18:00:00"

# The case that is live in production right now: books applied outside CI.
run_case "post-cutoff remote-only is drift and fails closed" 1 \
  "production has migrations that are not in this repository" "20260905133805" -- \
"   20260903120000 | 20260903120000 | 2026-09-03 12:00:00
                  | 20260905133805 | 2026-09-05 13:38:05"

# Legacy local-only is recorded as applied; the repair clears it on re-check.
run_case "legacy local-only is repaired, not replayed" 0 \
  "Freezing 1 legacy local-only" "No pending migrations" -- \
"   20260812000000 |                | 2026-08-12 00:00:00" \
"   20260812000000 | 20260812000000 | 2026-08-12 00:00:00"

run_case "clean history reports no pending work" 0 \
  "No pending migrations" -- \
"   20260903120000 | 20260903120000 | 2026-09-03 12:00:00"

run_case "pending and legacy can coexist" 0 \
  "Freezing 1 legacy local-only" "1 pending migration" -- \
"   20260812000000 |                | 2026-08-12 00:00:00
   20260905180000 |                | 2026-09-05 18:00:00" \
"   20260812000000 | 20260812000000 | 2026-08-12 00:00:00
   20260905180000 |                | 2026-09-05 18:00:00"

# Never apply new SQL onto a schema the repo cannot account for.
run_case "drift takes precedence over pending" 1 \
  "not in this repository" -- \
"   20260905180000 |                | 2026-09-05 18:00:00
                  | 20260905133805 | 2026-09-05 13:38:05"

# A repair that silently fails must not be reported as success.
run_case "unresolved legacy after repair still fails" 1 \
  "still differs after legacy reconciliation" -- \
"   20260812000000 |                | 2026-08-12 00:00:00" \
"   20260812000000 |                | 2026-08-12 00:00:00"

# The real production shape at the time of writing: three books migrations
# applied outside CI. All three must be named, not just the first.
run_case "every drifted version is reported, not just the first" 1 \
  "20260905131545" "20260905133805" "20260905150256" -- \
"                  | 20260905131545 | 2026-09-05 13:15:45
                  | 20260905133805 | 2026-09-05 13:38:05
                  | 20260905150256 | 2026-09-05 15:02:56"

# Once those files are committed under their recorded versions, the same
# history reconciles cleanly and the pending migration goes through.
run_case "books committed at recorded versions unblocks the pending migration" 0 \
  "1 pending migration" "20260905180000" -- \
"   20260905131545 | 20260905131545 | 2026-09-05 13:15:45
   20260905133805 | 20260905133805 | 2026-09-05 13:38:05
   20260905150256 | 20260905150256 | 2026-09-05 15:02:56
   20260905180000 |                | 2026-09-05 18:00:00"

echo
echo "  $pass passed, $fail failed"
[[ $fail -eq 0 ]]
