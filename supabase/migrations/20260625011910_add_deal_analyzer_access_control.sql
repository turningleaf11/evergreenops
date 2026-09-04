
alter table public.deal_analyzer_deals add column created_by uuid references auth.users(id);

create table public.deal_analyzer_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user' check (role in ('admin','user')),
  created_at timestamptz not null default now()
);

create table public.deal_analyzer_deal_shares (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deal_analyzer_deals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  permission text not null default 'edit' check (permission in ('view','edit')),
  shared_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (deal_id, user_id)
);

alter table public.deal_analyzer_roles enable row level security;
alter table public.deal_analyzer_deal_shares enable row level security;
grant all on public.deal_analyzer_roles to service_role;
grant all on public.deal_analyzer_deal_shares to service_role;

-- Seed Autumn as admin with access granted, since this app is hers.
insert into public.deal_analyzer_roles (user_id, role)
select id, 'admin' from auth.users where email = 'autumnalexander.rei@gmail.com'
on conflict (user_id) do update set role = 'admin';

insert into public.page_grants (user_id, page_key, granted_by)
select id, 'business-deal-analyzer', id from auth.users where email = 'autumnalexander.rei@gmail.com'
on conflict do nothing;
;
