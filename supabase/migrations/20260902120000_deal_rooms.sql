-- Deal Rooms add-on: acquisition/DD workspaces, deliberately separate from
-- the Deals/CRM sales pipeline (GHL-owned). A deal room may optionally link
-- to a CRM deal via linked_deal_id, but never requires one.

insert into addon_packs (slug, name, description, is_active)
values ('deal-rooms', 'Deal Rooms', 'Due-diligence workspaces for acquisitions.', true)
on conflict (slug) do nothing;

create table if not exists deal_rooms (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id),
  name text not null,
  status text not null default 'active',
  linked_deal_id uuid references deals(id),
  purchase_price numeric,
  real_estate_price numeric,
  business_price numeric,
  capital_raise_target numeric,
  cash_at_closing numeric,
  seller_financing_amount numeric,
  seller_financing_terms text,
  investor_multiple_min numeric,
  investor_multiple_max numeric,
  target_close_date date,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists deal_room_dd_items (
  id uuid primary key default gen_random_uuid(),
  deal_room_id uuid not null references deal_rooms(id) on delete cascade,
  category text not null,
  title text not null,
  status text not null default 'not_started',
  owner_name text,
  due_date date,
  risk text not null default 'medium',
  doc_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists deal_room_risks (
  id uuid primary key default gen_random_uuid(),
  deal_room_id uuid not null references deal_rooms(id) on delete cascade,
  title text not null,
  description text,
  severity text not null default 'manageable',
  owner_name text,
  created_at timestamptz not null default now()
);

create table if not exists deal_room_decisions (
  id uuid primary key default gen_random_uuid(),
  deal_room_id uuid not null references deal_rooms(id) on delete cascade,
  decided_at date not null default current_date,
  summary text not null,
  decided_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists deal_room_bookings (
  id uuid primary key default gen_random_uuid(),
  deal_room_id uuid not null references deal_rooms(id) on delete cascade,
  event_name text not null,
  event_date date,
  contract_amount numeric,
  seller_collected numeric,
  remaining_due numeric,
  vendor_cost numeric,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists deal_room_investors (
  id uuid primary key default gen_random_uuid(),
  deal_room_id uuid not null references deal_rooms(id) on delete cascade,
  investor_name text not null,
  amount numeric,
  multiple_offered numeric,
  status text not null default 'interested',
  notes text,
  updated_at timestamptz not null default now()
);

alter table deal_rooms enable row level security;
alter table deal_room_dd_items enable row level security;
alter table deal_room_risks enable row level security;
alter table deal_room_decisions enable row level security;
alter table deal_room_bookings enable row level security;
alter table deal_room_investors enable row level security;

create policy "deal_rooms authenticated all" on deal_rooms for all to authenticated using (true) with check (true);
create policy "deal_room_dd_items authenticated all" on deal_room_dd_items for all to authenticated using (true) with check (true);
create policy "deal_room_risks authenticated all" on deal_room_risks for all to authenticated using (true) with check (true);
create policy "deal_room_decisions authenticated all" on deal_room_decisions for all to authenticated using (true) with check (true);
create policy "deal_room_bookings authenticated all" on deal_room_bookings for all to authenticated using (true) with check (true);
create policy "deal_room_investors authenticated all" on deal_room_investors for all to authenticated using (true) with check (true);
