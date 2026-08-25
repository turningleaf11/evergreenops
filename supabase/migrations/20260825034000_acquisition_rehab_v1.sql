-- Evergreen Acquisition Rehab V1.
--
-- This is the acquisition-stage rehab allowance used by Cash before detailed
-- photos/inspection/contractor scope are normally available. The existing
-- rehab_cost_books / rehab_cost_book_items tables remain intact for later
-- detailed scope pricing.
--
-- Policy approved 2026-08-24:
--   Lipstick  $8-$12/sf,  $10k minimum
--   Light     $15-$25/sf, $20k minimum
--   Medium    $30-$45/sf, $35k minimum
--   Heavy     $50-$75/sf, $60k minimum
--   Full Reno $80-$120/sf,$90k minimum
-- Default unknown condition is Medium / Low confidence and uses the high side
-- of the resulting range as the modeled rehab for MAO.
-- Default contingency is 10% per Evergreen's Basic Repair Cost Guide.

create table if not exists public.acquisition_rehab_policies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 160),
  market text not null check (length(btrim(market)) between 1 and 160),
  version integer not null check (version >= 1),
  status text not null default 'draft' check (status in ('draft','active','retired')),
  default_contingency_pct numeric(5,2) not null check (default_contingency_pct >= 0 and default_contingency_pct <= 30),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, name, version)
);

create unique index if not exists acquisition_rehab_one_active_per_workspace_idx
  on public.acquisition_rehab_policies (workspace_id)
  where status = 'active';

create table if not exists public.acquisition_rehab_class_rates (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references public.acquisition_rehab_policies(id) on delete cascade,
  rehab_class text not null check (rehab_class in ('lipstick','light','medium','heavy','full_reno')),
  per_sqft_low numeric(12,2) not null check (per_sqft_low >= 0),
  per_sqft_base numeric(12,2) not null check (per_sqft_base >= per_sqft_low),
  per_sqft_high numeric(12,2) not null check (per_sqft_high >= per_sqft_base),
  minimum_rehab numeric(12,2) not null check (minimum_rehab >= 0),
  notes text,
  source_reference text not null check (length(btrim(source_reference)) between 1 and 1000),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (policy_id, rehab_class)
);

create table if not exists public.acquisition_rehab_adders (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references public.acquisition_rehab_policies(id) on delete cascade,
  adder_type text not null check (adder_type in (
    'roof','hvac','water_heater','plumbing','electrical_panel',
    'non_impact_windows','impact_windows','foundation'
  )),
  unit text not null check (unit in ('allowance','each')),
  unit_cost_low numeric(12,2) not null check (unit_cost_low >= 0),
  unit_cost_base numeric(12,2) not null check (unit_cost_base >= unit_cost_low),
  unit_cost_high numeric(12,2) not null check (unit_cost_high >= unit_cost_base),
  included_in_heavy_full boolean not null default true,
  notes text,
  source_reference text not null check (length(btrim(source_reference)) between 1 and 1000),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (policy_id, adder_type)
);

alter table public.acquisition_rehab_policies enable row level security;
alter table public.acquisition_rehab_class_rates enable row level security;
alter table public.acquisition_rehab_adders enable row level security;

revoke all on table public.acquisition_rehab_policies from public, anon, authenticated;
revoke all on table public.acquisition_rehab_class_rates from public, anon, authenticated;
revoke all on table public.acquisition_rehab_adders from public, anon, authenticated;
grant all on table public.acquisition_rehab_policies to service_role;
grant all on table public.acquisition_rehab_class_rates to service_role;
grant all on table public.acquisition_rehab_adders to service_role;

comment on table public.acquisition_rehab_policies is
  'Workspace-scoped acquisition-stage rehab allowance policy. Detailed rehab cost books remain separate.';
comment on table public.acquisition_rehab_class_rates is
  'Whole-property rehab class $/sf bands and minimum floors approved for acquisition underwriting.';
comment on table public.acquisition_rehab_adders is
  'Known big-ticket system adders sourced from Evergreen repair guidance; heavy/full classes can absorb normal systems to avoid double counting.';

-- Seed V1 only when the environment has exactly one workspace. This keeps the
-- migration portable without hardcoding a generated workspace UUID.
do $$
declare
  _workspace_id uuid;
  _policy_id uuid;
begin
  if (select count(*) from public.workspaces) = 1 then
    select id into _workspace_id from public.workspaces limit 1;

    insert into public.acquisition_rehab_policies (
      workspace_id, name, market, version, status, default_contingency_pct, notes
    ) values (
      _workspace_id,
      'Evergreen Acquisition Rehab',
      'South Florida',
      1,
      'active',
      10,
      'Owner-approved acquisition rehab policy. Class bands calibrated against Evergreen Basic Repair Cost Guide; unknown condition defaults to Medium/Low and high-side modeled rehab.'
    )
    on conflict (workspace_id, name, version) do update
      set status = excluded.status,
          default_contingency_pct = excluded.default_contingency_pct,
          notes = excluded.notes,
          updated_at = now()
    returning id into _policy_id;

    if _policy_id is null then
      select id into _policy_id
      from public.acquisition_rehab_policies
      where workspace_id = _workspace_id
        and name = 'Evergreen Acquisition Rehab'
        and version = 1;
    end if;

    insert into public.acquisition_rehab_class_rates
      (policy_id, rehab_class, per_sqft_low, per_sqft_base, per_sqft_high, minimum_rehab, notes, source_reference)
    values
      (_policy_id,'lipstick',8,10,12,10000,'Make-ready, cleanup, touchups, minor cosmetics; no broad renovation assumed.','Evergreen owner-approved Acquisition Rehab V1 policy 2026-08-24; calibrated against Basic Repair Cost Guide.'),
      (_policy_id,'light',15,20,25,20000,'Cosmetic renovation: paint/flooring/fixtures and modest kitchen/bath refresh; major systems excluded unless known.','Evergreen owner-approved Acquisition Rehab V1 policy 2026-08-24; calibrated against Basic Repair Cost Guide.'),
      (_policy_id,'medium',30,37.5,45,35000,'Meaningful renovation: kitchen/baths plus broad cosmetics and moderate deferred maintenance; major systems added when specifically known.','Evergreen owner-approved Acquisition Rehab V1 policy 2026-08-24; calibrated against Basic Repair Cost Guide.'),
      (_policy_id,'heavy',50,62.5,75,60000,'Major renovation with extensive deferred maintenance and normal expectation of multiple substantial components/systems.','Evergreen owner-approved Acquisition Rehab V1 policy 2026-08-24; calibrated against Basic Repair Cost Guide.'),
      (_policy_id,'full_reno',80,100,120,90000,'Gut or near-gut renovation / comprehensive rehabilitation.','Evergreen owner-approved Acquisition Rehab V1 policy 2026-08-24; calibrated against Basic Repair Cost Guide.')
    on conflict (policy_id, rehab_class) do update
      set per_sqft_low=excluded.per_sqft_low,
          per_sqft_base=excluded.per_sqft_base,
          per_sqft_high=excluded.per_sqft_high,
          minimum_rehab=excluded.minimum_rehab,
          notes=excluded.notes,
          source_reference=excluded.source_reference,
          active=true,
          updated_at=now();

    insert into public.acquisition_rehab_adders
      (policy_id, adder_type, unit, unit_cost_low, unit_cost_base, unit_cost_high, included_in_heavy_full, notes, source_reference)
    values
      (_policy_id,'roof','allowance',8000,11500,15000,true,'Known roof replacement. High-end in source is listed as $15,000+.','Evergreen Basic Repair Cost Guide p.1, approved for underwriting use 2026-08-24.'),
      (_policy_id,'hvac','allowance',5000,7500,10000,true,'Known HVAC system replacement.','Evergreen Basic Repair Cost Guide p.1, approved for underwriting use 2026-08-24.'),
      (_policy_id,'water_heater','allowance',1200,1850,2500,true,'Known water-heater replacement.','Evergreen Basic Repair Cost Guide p.1, approved for underwriting use 2026-08-24.'),
      (_policy_id,'plumbing','allowance',2000,4000,6000,true,'Known major plumbing repairs.','Evergreen Basic Repair Cost Guide p.1, approved for underwriting use 2026-08-24.'),
      (_policy_id,'electrical_panel','allowance',1500,2750,4000,true,'Known electrical-panel replacement/200-amp upgrade.','Evergreen Basic Repair Cost Guide p.1, approved for underwriting use 2026-08-24.'),
      (_policy_id,'non_impact_windows','each',300,550,800,true,'Known non-impact window replacement; quantity required.','Evergreen Basic Repair Cost Guide p.1, approved for underwriting use 2026-08-24.'),
      (_policy_id,'impact_windows','each',800,1300,1800,true,'Known impact window replacement; quantity required. High-end in source is listed as $1,800+.','Evergreen Basic Repair Cost Guide p.1, approved for underwriting use 2026-08-24.'),
      (_policy_id,'foundation','allowance',5000,10000,15000,false,'Known foundation repair; treated as extraordinary and additive even for Heavy/Full Reno. High-end in source is listed as $15,000+.','Evergreen Basic Repair Cost Guide p.1, approved for underwriting use 2026-08-24.')
    on conflict (policy_id, adder_type) do update
      set unit=excluded.unit,
          unit_cost_low=excluded.unit_cost_low,
          unit_cost_base=excluded.unit_cost_base,
          unit_cost_high=excluded.unit_cost_high,
          included_in_heavy_full=excluded.included_in_heavy_full,
          notes=excluded.notes,
          source_reference=excluded.source_reference,
          active=true,
          updated_at=now();
  end if;
end $$;
