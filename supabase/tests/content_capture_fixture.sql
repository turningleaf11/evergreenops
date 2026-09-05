create table workspaces (id uuid primary key default gen_random_uuid());
create table agents (id uuid primary key default gen_random_uuid(), name text, slug text unique, emoji text, enabled boolean default true);
create table pipeline_stages (id uuid primary key default gen_random_uuid(), name text);
create table deals (
  id uuid primary key default gen_random_uuid(), workspace_id uuid, stage_id uuid,
  title text, status text, property_address text, property_city text, property_state text,
  property_type text, units integer, asking_price numeric, mao numeric, our_value numeric,
  spread numeric, repair_estimate numeric, broker_feedback text, lost_reason text,
  primary_contact_id uuid, disposition_strategy text,
  stage_entered_at timestamptz, updated_at timestamptz, created_at timestamptz default now());
create table agent_tasks (
  id uuid primary key default gen_random_uuid(), workspace_id uuid, title text,
  description text, result text, context jsonb, type text, status text,
  assigned_to text, priority text, completed_at timestamptz, archived boolean default false,
  content_capture_eligible boolean not null default false,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  started_at timestamptz, deferred_until timestamptz, error text);
create table ai_logs (id uuid primary key default gen_random_uuid(), task_id uuid, agent_id uuid, agent_name text, agent_emoji text, category text, message text, created_at timestamptz default now());
