-- Per-project saved views (the "+ Add view" system). "List" is a built-in and
-- is not stored here; only user-added views are rows.
create table public.project_views (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  type text not null,                       -- 'board' | 'calendar' | 'timeline'
  name text not null,
  position integer not null default 0,
  config jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index project_views_project_idx on public.project_views(project_id, position);

alter table public.project_views enable row level security;

create policy "authenticated users can read project views"
  on public.project_views for select using (auth.uid() is not null);
create policy "authenticated users can insert project views"
  on public.project_views for insert with check (auth.uid() is not null);
create policy "authenticated users can update project views"
  on public.project_views for update using (auth.uid() is not null);
create policy "authenticated users can delete project views"
  on public.project_views for delete using (auth.uid() is not null);;
