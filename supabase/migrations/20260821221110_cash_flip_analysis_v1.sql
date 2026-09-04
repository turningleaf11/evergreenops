-- Cash Flip Analysis V1.
--
-- Adds a workspace-scoped, versioned policy profile for unlevered project
-- economics. No policy row is seeded here: acquisition/sale/hold/carry
-- assumptions must be explicitly approved before Cash can calculate profit or
-- return metrics.

create table if not exists public.flip_analysis_policies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  asset_class text not null default 'fix_flip',
  name text not null,
  market text not null,
  version integer not null check (version >= 1),
  status text not null default 'draft' check (status in ('draft', 'active', 'retired')),
  acquisition_closing_cost_pct numeric(7,4),
  sale_cost_pct numeric(7,4),
  hold_months integer,
  monthly_property_taxes numeric(14,2),
  monthly_insurance numeric(14,2),
  monthly_utilities numeric(14,2),
  monthly_maintenance numeric(14,2),
  monthly_hoa numeric(14,2),
  monthly_other_carry numeric(14,2),
  source_reference text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint flip_policy_asset_class_check check (asset_class = 'fix_flip'),
  constraint flip_policy_acquisition_pct_check check (
    acquisition_closing_cost_pct is null or
    (acquisition_closing_cost_pct >= 0 and acquisition_closing_cost_pct < 100)
  ),
  constraint flip_policy_sale_pct_check check (
    sale_cost_pct is null or (sale_cost_pct >= 0 and sale_cost_pct < 100)
  ),
  constraint flip_policy_hold_months_check check (
    hold_months is null or hold_months >= 1
  ),
  constraint flip_policy_property_taxes_check check (
    monthly_property_taxes is null or monthly_property_taxes >= 0
  ),
  constraint flip_policy_insurance_check check (
    monthly_insurance is null or monthly_insurance >= 0
  ),
  constraint flip_policy_utilities_check check (
    monthly_utilities is null or monthly_utilities >= 0
  ),
  constraint flip_policy_maintenance_check check (
    monthly_maintenance is null or monthly_maintenance >= 0
  ),
  constraint flip_policy_hoa_check check (
    monthly_hoa is null or monthly_hoa >= 0
  ),
  constraint flip_policy_other_carry_check check (
    monthly_other_carry is null or monthly_other_carry >= 0
  ),
  constraint flip_policy_source_reference_check check (length(trim(source_reference)) > 0),
  unique (workspace_id, asset_class, version)
);

create unique index if not exists flip_analysis_policies_one_active_per_workspace
  on public.flip_analysis_policies (workspace_id, asset_class)
  where status = 'active';

create index if not exists flip_analysis_policies_lookup_idx
  on public.flip_analysis_policies (workspace_id, asset_class, status, version desc);

alter table public.flip_analysis_policies enable row level security;
revoke all on table public.flip_analysis_policies from anon, authenticated;
grant select, insert, update, delete on table public.flip_analysis_policies to service_role;

comment on table public.flip_analysis_policies is
  'Versioned Evergreen assumptions for deterministic unlevered flip project economics. Active profiles are server-side policy, never model defaults.';
comment on column public.flip_analysis_policies.source_reference is
  'Required provenance for the approved policy profile, e.g. Evergreen policy decision, historical actuals analysis, or approved third-party benchmark.';

-- Add the durable Flip Analysis phase. Preserve all existing phases.
alter table public.cash_underwriting_steps
  drop constraint if exists cash_underwriting_steps_phase_check;

alter table public.cash_underwriting_steps
  add constraint cash_underwriting_steps_phase_check
  check (phase in ('cash_value', 'rehab', 'mao', 'flip_analysis', 'dealcheck', 'final'));;
