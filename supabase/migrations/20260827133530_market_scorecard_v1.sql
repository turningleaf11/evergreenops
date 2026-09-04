-- Market scorecard v1: turns the "markets" free-text AI blob into a structured,
-- category-by-category rubric (modeled on the manual scorecard Alexander built),
-- with per-row human/AI attribution, an append-only history log, and a
-- decision-change event so a flip doesn't require someone to notice it.

-- 1. Category catalog (static reference data, not per-market).
create table if not exists public.market_scorecard_categories (
  key text primary key,
  layer text not null check (layer in ('foundation', 'operator', 'personal')),
  label text not null,
  guidance text default '',
  ai_scorable boolean not null default true,
  sort_order integer not null default 0
);

alter table public.market_scorecard_categories enable row level security;
create policy "Authenticated can view scorecard categories"
  on public.market_scorecard_categories for select to authenticated using (true);

insert into public.market_scorecard_categories (key, layer, label, guidance, ai_scorable, sort_order) values
  ('population_trend', 'foundation', 'Population trend', 'Census / local MSA data', true, 1),
  ('job_growth', 'foundation', 'Job growth', 'BLS / FRED / local economic development', true, 2),
  ('major_employers', 'foundation', 'Major employers', 'Local econ dev / Chamber / cross-check', true, 3),
  ('median_household_income', 'foundation', 'Median household income', 'Census / DataUSA', true, 4),
  ('landlord_friendliness', 'foundation', 'Landlord friendliness', 'State law summary / attorney / PM', true, 5),
  ('rent_growth_trend', 'operator', 'Rent growth trend', 'CoStar / Yardi / Zillow / Apartments.com / broker reports', true, 6),
  ('vacancy_trend', 'operator', 'Vacancy trend', 'CoStar / Yardi / broker reports', true, 7),
  ('supply_pipeline', 'operator', 'Supply pipeline', 'Yardi / CoStar / local planning', true, 8),
  ('affordability_for_tenant', 'operator', 'Affordability for target tenant', 'Compare wages to rents', true, 9),
  ('crime_neighborhood', 'operator', 'Crime / neighborhood quality', 'City crime maps / AreaVibes / local knowledge', true, 10),
  ('school_retail_access', 'operator', 'School / retail / access', 'Google Maps / local recon', true, 11),
  ('property_management_depth', 'operator', 'Property management depth', 'Google / referrals / BiggerPockets / local brokers', true, 12),
  ('taxes_insurance', 'operator', 'Taxes / insurance environment', 'County assessor / insurance quotes / broker', true, 13),
  ('liquidity_exit', 'operator', 'Liquidity / exit market', 'Broker feedback / listings / sales comps', true, 14),
  ('deal_size_fit', 'personal', 'Deal size fit', 'Match to capital + time + management reality', false, 15),
  ('strategy_fit', 'personal', 'Strategy fit', 'Does this market support the target strategy?', false, 16),
  ('personal_bias_check', 'personal', 'Personal bias check', 'Gut-check for emotional contamination', false, 17)
on conflict (key) do nothing;

-- 2. Per-market rows against that catalog.
create table if not exists public.market_scorecard_rows (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references public.markets(id) on delete cascade,
  category text not null references public.market_scorecard_categories(key),
  rating text check (rating in ('green', 'yellow', 'red')),
  note text default '',
  source text default '',
  is_core_red boolean not null default false,
  conflict_flag boolean not null default false,
  conflict_note text default '',
  updated_by_kind text not null default 'ai' check (updated_by_kind in ('ai', 'human')),
  updated_by uuid,
  updated_at timestamptz not null default now(),
  unique (market_id, category)
);

alter table public.market_scorecard_rows enable row level security;

create policy "Workspace members view scorecard rows" on public.market_scorecard_rows
  for select to authenticated using (
    exists (
      select 1 from public.markets m
      where m.id = market_scorecard_rows.market_id
        and m.workspace_id = public.get_user_workspace_id()
    )
  );

create policy "Workspace members write scorecard rows" on public.market_scorecard_rows
  for all to authenticated using (
    exists (
      select 1 from public.markets m
      where m.id = market_scorecard_rows.market_id
        and m.workspace_id = public.get_user_workspace_id()
    )
  ) with check (
    exists (
      select 1 from public.markets m
      where m.id = market_scorecard_rows.market_id
        and m.workspace_id = public.get_user_workspace_id()
    )
  );

create index if not exists idx_market_scorecard_rows_market_id on public.market_scorecard_rows(market_id);

-- 3. Append-only history: every insert/update of a row is logged automatically,
-- so the timeline view never depends on the app remembering to write twice.
create table if not exists public.market_scorecard_row_history (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references public.markets(id) on delete cascade,
  category text not null,
  rating text,
  note text,
  source text,
  is_core_red boolean,
  conflict_flag boolean,
  updated_by_kind text not null,
  updated_by uuid,
  changed_at timestamptz not null default now()
);

alter table public.market_scorecard_row_history enable row level security;

create policy "Workspace members view scorecard history" on public.market_scorecard_row_history
  for select to authenticated using (
    exists (
      select 1 from public.markets m
      where m.id = market_scorecard_row_history.market_id
        and m.workspace_id = public.get_user_workspace_id()
    )
  );

create index if not exists idx_market_scorecard_row_history_market_id
  on public.market_scorecard_row_history(market_id, category, changed_at desc);

create or replace function public.log_market_scorecard_row_change()
returns trigger language plpgsql as $$
begin
  insert into public.market_scorecard_row_history (
    market_id, category, rating, note, source, is_core_red, conflict_flag,
    updated_by_kind, updated_by
  ) values (
    new.market_id, new.category, new.rating, new.note, new.source, new.is_core_red, new.conflict_flag,
    new.updated_by_kind, new.updated_by
  );
  return new;
end;
$$;

drop trigger if exists trg_log_market_scorecard_row_change on public.market_scorecard_rows;
create trigger trg_log_market_scorecard_row_change
  after insert or update on public.market_scorecard_rows
  for each row execute function public.log_market_scorecard_row_change();

create trigger update_market_scorecard_rows_updated_at
  before update on public.market_scorecard_rows
  for each row execute function public.update_updated_at_column();

-- 4. Decision + asset-class fields on markets, plus a change-detection trigger
--    that raises an event (reusing the existing events backbone) whenever a
--    market's decision flips after the first score.
alter table public.markets
  add column if not exists decision text check (decision in ('go', 'watch', 'no_go')),
  add column if not exists decision_why text default '',
  add column if not exists decision_next_step text default '',
  add column if not exists asset_class text,
  add column if not exists last_scored_at timestamptz;

create or replace function public.log_market_decision_change()
returns trigger language plpgsql as $$
begin
  if old.decision is distinct from new.decision and old.decision is not null then
    insert into public.events (
      type, severity, title, source, entity_type, entity_id, entity_label, needs_action, metadata
    ) values (
      'market_decision_change',
      case when new.decision = 'no_go' then 'warning' else 'info' end,
      new.name || ' moved from ' || upper(old.decision) || ' to ' || upper(new.decision),
      'opshq',
      'market',
      new.id,
      new.name,
      true,
      jsonb_build_object('previous_decision', old.decision, 'new_decision', new.decision)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_log_market_decision_change on public.markets;
create trigger trg_log_market_decision_change
  after update on public.markets
  for each row execute function public.log_market_decision_change();
;
