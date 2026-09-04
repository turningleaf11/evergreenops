-- The hub's standings answer "who brought us deals worth underwriting", but the table
-- only records `run_by` (which agent or tool executed the underwrite), not who sourced
-- the deal. Without attribution to a person, the leaderboard can't be computed at all.

ALTER TABLE underwriting_runs
  ADD COLUMN IF NOT EXISTS sourced_by uuid,
  ADD COLUMN IF NOT EXISTS source_channel text;

ALTER TABLE underwriting_runs
  DROP CONSTRAINT IF EXISTS underwriting_runs_source_channel_check;

ALTER TABLE underwriting_runs
  ADD CONSTRAINT underwriting_runs_source_channel_check
  CHECK (source_channel IS NULL OR source_channel IN ('dta','dtb','dtw','dts','other'));

COMMENT ON COLUMN underwriting_runs.sourced_by IS
  'The person who found/submitted this deal (auth user id). Distinct from run_by, which is the agent or tool that performed the underwrite. Drives the hub leaderboard.';
COMMENT ON COLUMN underwriting_runs.source_channel IS
  'Which door the deal came through: dta, dtb, dtw, dts, other.';

CREATE INDEX IF NOT EXISTS underwriting_runs_sourced_by_idx
  ON underwriting_runs (sourced_by, created_at DESC)
  WHERE sourced_by IS NOT NULL;;
