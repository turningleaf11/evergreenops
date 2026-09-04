-- Team Hub accounts are provisioned through OpsHQ's existing invite flow, same
-- as any other user, but marked with this role so they can be excluded from
-- OpsHQ-only tables (CRM, deal/transaction documents). Enum values must commit
-- before use, so this is deliberately its own migration.
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'team_hub';;
