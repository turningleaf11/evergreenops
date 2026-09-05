#!/usr/bin/env bash
#
# Reconcile the Supabase migration history before `supabase db push`.
#
# Background: production migration history predating the frozen cutoff was
# created by several deploy paths and was not consistently source-controlled,
# and some of those historical statements contain credential-like literals that
# must not be exported into this public repo. That cohort is frozen as an
# already-applied baseline instead of being replayed.
#
# The classification below is the whole point of this script. A version can be
# missing from one side for two very different reasons, and only one of them is
# a problem:
#
#   local-only, newer than cutoff   -> PENDING. A migration that has been
#                                      committed but not yet applied. This is
#                                      the normal state of every new migration
#                                      and is exactly what `db push` is for.
#   remote-only, newer than cutoff  -> DRIFT. Production ran something that is
#                                      not in the repo, so the repo is no longer
#                                      the source of truth. Fail closed.
#   local-only, at/below cutoff     -> legacy file production already absorbed.
#                                      Record as applied without executing it.
#   remote-only, at/below cutoff    -> legacy production history. Materialize a
#                                      no-op marker so the CLI can compare
#                                      histories without publishing old SQL.
#
# An earlier version of this step treated every post-cutoff mismatch as fatal,
# which also rejected pending migrations — that is, every new migration — and so
# would block all schema work. Treating "not deployed yet" as drift is what
# pushes people to apply migrations to production by hand, which creates the
# real drift this script exists to catch.
#
# The two commands are indirected through variables so the classification can be
# tested without a live project.

set -euo pipefail

LEGACY_CUTOFF="${LEGACY_CUTOFF:-20260903223617}"
MIGRATIONS_DIR="${MIGRATIONS_DIR:-supabase/migrations}"
MIGRATION_LIST_CMD="${MIGRATION_LIST_CMD:-supabase migration list --linked --password ${SUPABASE_DB_PASSWORD:-}}"
MIGRATION_REPAIR_CMD="${MIGRATION_REPAIR_CMD:-supabase migration repair --linked --password ${SUPABASE_DB_PASSWORD:-}}"

list_mismatches() {
  $MIGRATION_LIST_CMD | awk -F'|' '
    function clean(s) {
      gsub(/[`[:space:]]/, "", s)
      return s
    }
    NF >= 2 {
      local_version = clean($1)
      remote_version = clean($2)
      version_re = "^[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]$"
      if (local_version ~ version_re && remote_version == "") print "local " local_version
      if (local_version == "" && remote_version ~ version_re) print "remote " remote_version
    }
  '
}

classify() {
  local side version
  legacy_local_only=()
  legacy_remote_only=()
  pending=()
  drift=()

  while read -r side version; do
    [[ -z "${version:-}" ]] && continue
    if [[ "$version" > "$LEGACY_CUTOFF" ]]; then
      case "$side" in
        local)  pending+=("$version") ;;
        remote) drift+=("$version") ;;
        *) echo "ERROR: unrecognized migration mismatch: $side $version" >&2; return 2 ;;
      esac
    else
      case "$side" in
        local)  legacy_local_only+=("$version") ;;
        remote) legacy_remote_only+=("$version") ;;
        *) echo "ERROR: unrecognized migration mismatch: $side $version" >&2; return 2 ;;
      esac
    fi
  done
}

main() {
  classify < <(list_mismatches)

  # Drift is fatal and is never normalized away: production has run SQL that
  # this repo does not contain, so merging would silently diverge further.
  if (( ${#drift[@]} > 0 )); then
    echo "ERROR: production has migrations that are not in this repository:"
    printf '  %s\n' "${drift[@]}"
    echo
    echo "This means a migration was applied to production directly instead of"
    echo "through this workflow. Commit the missing migration file(s) to main so"
    echo "the repo matches production, then re-run. Do not repair around this."
    exit 1
  fi

  if (( ${#legacy_local_only[@]} > 0 )); then
    echo "Freezing ${#legacy_local_only[@]} legacy local-only migration version(s) as applied."
    $MIGRATION_REPAIR_CMD "${legacy_local_only[@]}" --status applied
  fi

  for version in "${legacy_remote_only[@]}"; do
    if compgen -G "${MIGRATIONS_DIR}/${version}_*.sql" > /dev/null; then
      continue
    fi
    marker="${MIGRATIONS_DIR}/${version}_legacy_remote_history.sql"
    cat > "$marker" <<EOF
-- Frozen historical migration marker for opshq production version ${version}.
-- This no-op file exists only during CI deployment history reconciliation.
-- Historical SQL is intentionally not exported to the public repository.
EOF
    echo "Materialized legacy remote marker: $marker"
  done

  # Re-check. After reconciliation the only acceptable remaining mismatches are
  # post-cutoff local-only versions, which are the pending migrations db push is
  # about to apply.
  classify < <(list_mismatches)

  if (( ${#drift[@]} > 0 || ${#legacy_local_only[@]} > 0 || ${#legacy_remote_only[@]} > 0 )); then
    echo "ERROR: migration history still differs after legacy reconciliation:"
    printf '  drift(remote-only): %s\n' "${drift[@]:-none}"
    printf '  legacy local-only:  %s\n' "${legacy_local_only[@]:-none}"
    printf '  legacy remote-only: %s\n' "${legacy_remote_only[@]:-none}"
    exit 1
  fi

  if (( ${#pending[@]} > 0 )); then
    echo "Migration history aligned. ${#pending[@]} pending migration(s) to apply:"
    printf '  %s\n' "${pending[@]}"
  else
    echo "Migration history aligned. No pending migrations."
  fi
}

main "$@"
