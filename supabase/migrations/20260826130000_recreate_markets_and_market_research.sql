-- Recreates markets + market_research, which the migration ledger shows as
-- applied but which no longer exist on the live database (dropped manually,
-- outside of any tracked migration — see investigation in session notes).
-- Schema matches the original migrations exactly; only the creation order is
-- fixed so market_research exists before markets' FK column references it.

create table if not exists public.market_research (
  id uuid not null default gen_random_uuid() primary key,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  market_name text not null,
  strategy text not null default '',
  ai_analysis jsonb default '{}'::jsonb,
  status text not null default 'pending',
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.market_research enable row level security;
create policy "Authenticated can view market research" on public.market_research for select to authenticated using (true);
create policy "Authenticated can create market research" on public.market_research for insert to authenticated with check (auth.uid() = created_by);
create policy "Admins can manage all market research" on public.market_research for all to authenticated using (has_role(auth.uid(), 'admin'::app_role));
create trigger update_market_research_updated_at before update on public.market_research for each row execute function public.update_updated_at_column();

create table if not exists public.markets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  name text not null,
  location text default '',
  strategy text default '',
  criteria text default '',
  notes_html text default '',
  links jsonb not null default '[]'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.markets enable row level security;

create policy "Workspace members view markets" on public.markets
  for select to authenticated
  using (workspace_id = public.get_user_workspace_id());

create policy "Workspace members create markets" on public.markets
  for insert to authenticated
  with check (workspace_id = public.get_user_workspace_id() and auth.uid() = created_by);

create policy "Workspace members update markets" on public.markets
  for update to authenticated
  using (workspace_id = public.get_user_workspace_id());

create policy "Workspace members delete markets" on public.markets
  for delete to authenticated
  using (workspace_id = public.get_user_workspace_id());

create trigger update_markets_updated_at
  before update on public.markets
  for each row execute function public.update_updated_at_column();

alter table public.market_research
  add column if not exists market_id uuid references public.markets(id) on delete cascade;

create index if not exists idx_market_research_market_id on public.market_research(market_id);
create index if not exists idx_markets_workspace_id on public.markets(workspace_id);
