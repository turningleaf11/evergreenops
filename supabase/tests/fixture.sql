create schema if not exists auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select current_setting('test.uid', true)::uuid $$;

create table workspaces (id uuid primary key default gen_random_uuid());
create table profiles (user_id uuid primary key references auth.users(id), workspace_id uuid references workspaces(id));

create function public.get_user_workspace_id() returns uuid
  language sql stable security definer set search_path to 'public'
  as $$ select workspace_id from public.profiles where user_id = auth.uid() limit 1 $$;

create table content_brands (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  workspace_id uuid, name text, color text, audience text, voice text, mission text,
  seeds jsonb, canva_kit_id text, sort_order integer,
  created_at timestamptz default now(), updated_at timestamptz default now());

create table content_library (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  workspace_id uuid,
  brand_id uuid references content_brands(id) on delete set null,
  brand_name text, brand_color text, platform text, platform_label text,
  content text, seed text, image_url text,
  status text check (status in ('draft','approved','posted','archived')),
  canva_url text, created_at timestamptz default now());

create table agent_tasks (
  id uuid primary key default gen_random_uuid(),
  title text, assigned_to text, status text, completed_at timestamptz,
  workspace_id uuid);
alter table content_brands enable row level security;
alter table content_library enable row level security;
create policy content_brands_own on content_brands for all using (auth.uid() = user_id);
create policy content_library_own on content_library for all using (auth.uid() = user_id);
