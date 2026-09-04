
ALTER TABLE scorecard_entries
ADD CONSTRAINT scorecard_entries_metric_week_unique
UNIQUE (metric_id, week_start_date);
;
