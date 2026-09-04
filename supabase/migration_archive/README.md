# Supabase migration archive

The files under `untracked/` are historical repository SQL files whose migration versions were never recorded in the production Supabase `schema_migrations` history and for which no unique production-tracked equivalent could be proven during the 2026-09-04 history repair.

They are intentionally excluded from `supabase/migrations` so normal `supabase db push` cannot back-apply old SQL out of order. If an archived change is still desired, reintroduce it as a new timestamped migration after verifying current production state. Do not history-mark these files as applied merely to silence the CLI.
