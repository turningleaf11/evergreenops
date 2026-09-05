create table workspaces (id uuid primary key default gen_random_uuid());
create table agents (
  id uuid primary key default gen_random_uuid(),
  name text, slug text unique, emoji text, enabled boolean not null default true);
create table agent_tasks (
  id uuid primary key default gen_random_uuid(),
  title text, description text, assigned_to text, status text, priority text,
  context jsonb, result text, error text, workspace_id uuid references workspaces(id),
  created_at timestamptz default now(), updated_at timestamptz default now(),
  started_at timestamptz, completed_at timestamptz, deferred_until timestamptz,
  type text, archived boolean default false);
create table ai_logs (
  id uuid primary key default gen_random_uuid(), task_id uuid, agent_id uuid,
  agent_name text, agent_emoji text, category text, message text,
  created_at timestamptz default now());
