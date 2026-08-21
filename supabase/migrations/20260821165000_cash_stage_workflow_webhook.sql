-- Cash can be activated from a GoHighLevel workflow webhook as an alternative
-- to the Marketplace OpportunityStageUpdate subscription. The workflow path
-- uses a dedicated Bearer secret whose SHA-256 hash is stored in app_settings;
-- the raw secret is never stored in Postgres.

alter table public.ghl_stage_events
  drop constraint if exists ghl_stage_events_signature_kind_check;

alter table public.ghl_stage_events
  add constraint ghl_stage_events_signature_kind_check
  check (signature_kind = any (array[
    'ghl_ed25519'::text,
    'ghl_workflow_bearer'::text
  ]));

alter table public.ghl_stage_events
  drop constraint if exists ghl_stage_events_decision_check;

alter table public.ghl_stage_events
  add constraint ghl_stage_events_decision_check
  check (decision = any (array[
    'received'::text,
    'rejected_signature'::text,
    'rejected_auth'::text,
    'malformed'::text,
    'ignored_event_type'::text,
    'rejected_location'::text,
    'ignored_wrong_pipeline'::text,
    'ignored_wrong_stage'::text,
    'stale_or_mismatched_opportunity'::text,
    'unknown_opportunity'::text,
    'activated'::text,
    'reconciled'::text,
    'duplicate'::text,
    'failed'::text
  ]));

comment on table public.ghl_stage_events is
  'Audited HighLevel stage-trigger deliveries. Supports native Ed25519 Marketplace webhooks and Evergreen-controlled hashed-Bearer workflow webhooks.';
