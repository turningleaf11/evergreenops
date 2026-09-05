-- Books: a real double-entry ledger for the Evergreen entities.
--
-- Replaces Wave as the system of record from 2025-01-01 forward. Wave freezes
-- as the 2023-2024 historical record; opening balances at the cutover come in
-- as journal entries with source = 'opening', taken from the CPA's closing
-- trial balance for 2024.
--
-- Why double entry rather than a category on each bank row: the four things
-- that made Wave unusable here all need it.
--
--   * A mortgage payment is not one number. It splits into principal against
--     the loan liability, interest to expense, and escrow to tax and
--     insurance. One bank row, three lines.
--   * A cost paid by the wrong entity is not a reclass. It is a due-from on
--     one balance sheet and a due-to on the other, and both have to tie.
--   * K-1s need a capital account per partner, not one lumped equity account.
--   * A property that was never capitalised has no basis and no accumulated
--     depreciation, so its sale cannot be computed.
--
-- Structure: a bank row (book_transactions) is categorised, which POSTS a
-- journal entry (book_journal_entries) of two or more lines
-- (book_journal_lines). Lines are the truth; everything else is bookkeeping
-- around them. A deferred constraint enforces that every entry balances, so an
-- unbalanced entry cannot be committed under any code path.

-- ---------------------------------------------------------------- entities

create table if not exists public.book_entities (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null,
  name              text not null,
  legal_name        text,
  entity_type       text not null default 'llc',
  home_state        text,
  ein               text,
  -- Thor Legacy owns Evergreen Funded; the K-1 chain follows this column.
  parent_entity_id  uuid references public.book_entities(id) on delete set null,
  is_active         boolean not null default true,
  -- Final year for an entity being dissolved; drives the final-return flag.
  final_tax_year    integer,
  notes             text,
  created_at        timestamptz not null default now(),
  unique (workspace_id, name)
);

-- Partners are people or entities that hold capital. Kept separate from
-- book_entities because a partner may be an outside party (Tilisa holds her
-- 1109 interest through her own LLC) and never gets books of its own here.
create table if not exists public.book_partners (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null,
  name          text not null,
  legal_name    text,
  is_entity     boolean not null default false,
  notes         text,
  created_at    timestamptz not null default now(),
  unique (workspace_id, name)
);

create table if not exists public.book_entity_partners (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null,
  entity_id      uuid not null references public.book_entities(id) on delete cascade,
  partner_id     uuid not null references public.book_partners(id) on delete restrict,
  ownership_pct  numeric(7,4),
  effective_from date,
  effective_to   date,
  notes          text,
  unique (entity_id, partner_id, effective_from)
);

-- ---------------------------------------------------------- chart of accounts

create table if not exists public.book_accounts (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null,
  -- Null entity_id = shared across every entity (software, bank fees).
  entity_id      uuid references public.book_entities(id) on delete cascade,
  code           text not null,
  name           text not null,
  account_type   text not null
                   check (account_type in ('asset','liability','equity','income','expense')),
  subtype        text,
  -- Equity accounts tagged to a partner give per-partner capital accounts.
  partner_id     uuid references public.book_partners(id) on delete set null,
  -- The other entity, for due-to/due-from accounts. Lets the intercompany
  -- reconciliation prove both sides without parsing account names.
  counterparty_entity_id uuid references public.book_entities(id) on delete set null,
  is_active      boolean not null default true,
  description    text,
  created_at     timestamptz not null default now(),
  unique (workspace_id, entity_id, code)
);

create index if not exists book_accounts_lookup
  on public.book_accounts (workspace_id, entity_id, account_type) where is_active;

-- ------------------------------------------------------------ bank accounts

-- The organisation an account is held under is NOT the entity that owns the
-- money. The 1109 Riviera accounts sit under the Evergreen Creative Mercury
-- organisation because EC acted as trustee, while the trust's beneficiary --
-- and therefore the owner of the income -- was 1109 Riviera, LLC. Conflating
-- the two puts income on the wrong tax return.
create table if not exists public.book_bank_accounts (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null,
  entity_id       uuid not null references public.book_entities(id) on delete restrict,
  institution     text not null default 'Mercury',
  org_label       text,
  display_name    text not null,
  last_four       text,
  -- The cash account these transactions post against.
  gl_account_id   uuid references public.book_accounts(id) on delete set null,
  is_active       boolean not null default true,
  notes           text,
  created_at      timestamptz not null default now(),
  unique (workspace_id, institution, last_four)
);

-- ------------------------------------------------------------------ periods

create table if not exists public.book_periods (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null,
  entity_id     uuid not null references public.book_entities(id) on delete cascade,
  fiscal_year   integer not null,
  status        text not null default 'open'
                  check (status in ('open','closed','filed')),
  locked_at     timestamptz,
  locked_by     uuid,
  notes         text,
  unique (entity_id, fiscal_year)
);

-- ------------------------------------------------------------------- rules

create table if not exists public.book_rules (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null,
  -- Null entity_id = applies to every entity.
  entity_id     uuid references public.book_entities(id) on delete cascade,
  match_pattern text not null,
  match_field   text not null default 'description'
                  check (match_field in ('description','bank_description','both')),
  priority      integer not null default 100,
  -- What posting to make. Percentages let one bank row split across accounts
  -- without knowing the amount in advance.
  splits        jsonb not null default '[]'::jsonb,
  treatment     text not null default 'post'
                  check (treatment in ('post','transfer','intercompany','review')),
  note          text,
  hit_count     integer not null default 0,
  last_hit_at   timestamptz,
  created_by    uuid,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

create index if not exists book_rules_order
  on public.book_rules (workspace_id, priority, id) where is_active;

-- ------------------------------------------------------------- transactions

-- The raw bank feed. Never edited: categorisation happens by posting a journal
-- entry and pointing back here.
create table if not exists public.book_transactions (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null,
  bank_account_id  uuid not null references public.book_bank_accounts(id) on delete restrict,
  entity_id        uuid not null references public.book_entities(id) on delete restrict,
  txn_date         date not null,
  description      text not null default '',
  bank_description text,
  memo             text,
  amount           numeric(14,2) not null,
  status           text not null default 'posted'
                     check (status in ('posted','pending','failed')),
  failure_reason   text,
  -- Stable id from the import so re-running a month cannot duplicate rows.
  external_id      text,
  import_batch     uuid,
  -- How the categorisation was reached, and how confident it is. AI output is
  -- never posted without a human pass; this records provenance either way.
  suggested_by     text check (suggested_by in ('rule','ai','human')),
  confidence       numeric(4,3),
  ai_reasoning     text,
  review_state     text not null default 'unreviewed'
                     check (review_state in ('unreviewed','needs_review','accepted','excluded')),
  review_note      text,
  reviewed_by      uuid,
  reviewed_at      timestamptz,
  created_at       timestamptz not null default now(),
  unique (workspace_id, bank_account_id, external_id)
);

create index if not exists book_transactions_review
  on public.book_transactions (workspace_id, entity_id, review_state, txn_date desc);

-- ----------------------------------------------------------- journal entries

create table if not exists public.book_journal_entries (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null,
  entity_id       uuid not null references public.book_entities(id) on delete restrict,
  entry_date      date not null,
  memo            text,
  -- 'opening' carries the 2025-01-01 cutover balances from the CPA's closing
  -- trial balance. 'adjusting' carries the CPA's year-end entries.
  source          text not null default 'bank'
                    check (source in ('bank','manual','adjusting','opening','closing')),
  transaction_id  uuid references public.book_transactions(id) on delete set null,
  -- Set on both sides of an intercompany pair so the reconciliation can prove
  -- the legs match rather than inferring it from amounts.
  intercompany_group uuid,
  created_by      uuid,
  created_at      timestamptz not null default now()
);

create index if not exists book_journal_entries_period
  on public.book_journal_entries (workspace_id, entity_id, entry_date);

create table if not exists public.book_journal_lines (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  entry_id     uuid not null references public.book_journal_entries(id) on delete cascade,
  account_id   uuid not null references public.book_accounts(id) on delete restrict,
  -- Tags an equity line to a partner so capital accounts roll forward.
  partner_id   uuid references public.book_partners(id) on delete set null,
  debit        numeric(14,2) not null default 0,
  credit       numeric(14,2) not null default 0,
  memo         text,
  line_no      integer,
  constraint book_journal_lines_one_side
    check ((debit = 0) <> (credit = 0)),
  constraint book_journal_lines_non_negative
    check (debit >= 0 and credit >= 0)
);

create index if not exists book_journal_lines_entry
  on public.book_journal_lines (entry_id);
create index if not exists book_journal_lines_account
  on public.book_journal_lines (workspace_id, account_id);

-- --------------------------------------------------- an entry must balance

-- Deferred so a multi-line entry can be inserted a line at a time inside one
-- transaction, but cannot be committed unbalanced by any code path.
create or replace function public.book_assert_entry_balances()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  _entry_id uuid := coalesce(new.entry_id, old.entry_id);
  _dr numeric(14,2);
  _cr numeric(14,2);
begin
  select coalesce(sum(debit), 0), coalesce(sum(credit), 0)
    into _dr, _cr
    from public.book_journal_lines
   where entry_id = _entry_id;

  -- An entry whose lines were all removed is being deleted; let it go.
  if _dr = 0 and _cr = 0 then
    return null;
  end if;

  if _dr <> _cr then
    raise exception
      'Journal entry % does not balance: debits %, credits %, difference %',
      _entry_id, _dr, _cr, _dr - _cr;
  end if;

  return null;
end;
$$;

drop trigger if exists book_journal_lines_balance on public.book_journal_lines;
create constraint trigger book_journal_lines_balance
  after insert or update or delete on public.book_journal_lines
  deferrable initially deferred
  for each row execute function public.book_assert_entry_balances();

-- ------------------------------------------------- a filed period is closed

create or replace function public.book_assert_period_open()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  _status text;
begin
  select status into _status
    from public.book_periods
   where entity_id = new.entity_id
     and fiscal_year = extract(year from new.entry_date)::integer;

  if _status = 'filed' then
    raise exception
      'Cannot post to % for entity % - that year is filed. Reopen the period deliberately if the return is being amended.',
      extract(year from new.entry_date)::integer, new.entity_id;
  end if;

  return new;
end;
$$;

drop trigger if exists book_journal_entries_period_open on public.book_journal_entries;
create trigger book_journal_entries_period_open
  before insert or update on public.book_journal_entries
  for each row execute function public.book_assert_period_open();

-- ------------------------------------------------------------------- views

-- Trial balance. If this does not tie, nothing downstream can be trusted.
create or replace view public.book_trial_balance as
select
  l.workspace_id,
  e.entity_id,
  extract(year from e.entry_date)::integer as fiscal_year,
  a.id   as account_id,
  a.code,
  a.name as account_name,
  a.account_type,
  sum(l.debit)  as total_debit,
  sum(l.credit) as total_credit,
  case
    when a.account_type in ('asset','expense') then sum(l.debit) - sum(l.credit)
    else sum(l.credit) - sum(l.debit)
  end as balance
from public.book_journal_lines l
join public.book_journal_entries e on e.id = l.entry_id
join public.book_accounts a        on a.id = l.account_id
group by l.workspace_id, e.entity_id, 3, a.id, a.code, a.name, a.account_type;

-- Intercompany must net to zero across all entities. A non-zero figure means a
-- leg is missing, doubled, or attributed to the wrong entity.
create or replace view public.book_intercompany_check as
select
  l.workspace_id,
  extract(year from e.entry_date)::integer as fiscal_year,
  e.intercompany_group,
  sum(l.debit - l.credit) as net
from public.book_journal_lines l
join public.book_journal_entries e on e.id = l.entry_id
join public.book_accounts a        on a.id = l.account_id
where a.counterparty_entity_id is not null
group by l.workspace_id, 2, e.intercompany_group;

-- Capital account per partner per entity, which is what the K-1s are built on.
create or replace view public.book_partner_capital as
select
  l.workspace_id,
  e.entity_id,
  l.partner_id,
  p.name as partner_name,
  extract(year from e.entry_date)::integer as fiscal_year,
  sum(l.credit - l.debit) as capital_balance
from public.book_journal_lines l
join public.book_journal_entries e on e.id = l.entry_id
join public.book_accounts a        on a.id = l.account_id
join public.book_partners p        on p.id = l.partner_id
where a.account_type = 'equity' and l.partner_id is not null
group by l.workspace_id, e.entity_id, l.partner_id, p.name, 5;

-- --------------------------------------------------------------------- RLS

alter table public.book_entities         enable row level security;
alter table public.book_partners         enable row level security;
alter table public.book_entity_partners  enable row level security;
alter table public.book_accounts         enable row level security;
alter table public.book_bank_accounts    enable row level security;
alter table public.book_periods          enable row level security;
alter table public.book_rules            enable row level security;
alter table public.book_transactions     enable row level security;
alter table public.book_journal_entries  enable row level security;
alter table public.book_journal_lines    enable row level security;

create policy "book_entities authenticated all"        on public.book_entities        for all to authenticated using (true) with check (true);
create policy "book_partners authenticated all"        on public.book_partners        for all to authenticated using (true) with check (true);
create policy "book_entity_partners authenticated all" on public.book_entity_partners for all to authenticated using (true) with check (true);
create policy "book_accounts authenticated all"        on public.book_accounts        for all to authenticated using (true) with check (true);
create policy "book_bank_accounts authenticated all"   on public.book_bank_accounts   for all to authenticated using (true) with check (true);
create policy "book_periods authenticated all"         on public.book_periods         for all to authenticated using (true) with check (true);
create policy "book_rules authenticated all"           on public.book_rules           for all to authenticated using (true) with check (true);
create policy "book_transactions authenticated all"    on public.book_transactions    for all to authenticated using (true) with check (true);
create policy "book_journal_entries authenticated all" on public.book_journal_entries for all to authenticated using (true) with check (true);
create policy "book_journal_lines authenticated all"   on public.book_journal_lines   for all to authenticated using (true) with check (true);
