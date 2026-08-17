-- Agent Gateway security foundation.
-- Agents authenticate with per-agent opaque credentials whose raw values are
-- never stored in Postgres. Only service-role-backed Edge Functions may access
-- these tables; autonomous agents never receive direct database access.

alter table public.agents
  add column if not exists enabled boolean not null default true;

comment on column public.agents.enabled is
  'Emergency Gateway kill switch. False denies every capability for the agent.';

create table public.agent_api_credentials (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  token_prefix text not null,
  token_hash text not null unique,
  expires_at timestamptz,
  last_used_at timestamptz,
  revoked_at timestamptz,
  rotated_from_id uuid references public.agent_api_credentials(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(token_prefix) between 4 and 32),
  check (token_hash ~ '^[0-9a-f]{64}$'),
  check (expires_at is null or expires_at > created_at)
);

create table public.agent_permissions (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  action text not null,
  enabled boolean not null default false,
  rate_limit_per_minute integer not null default 60
    check (rate_limit_per_minute between 1 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agent_id, action),
  check (action ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$')
);

create table public.agent_gateway_operations (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  agent_id uuid not null references public.agents(id) on delete restrict,
  credential_id uuid references public.agent_api_credentials(id) on delete set null,
  action text not null,
  idempotency_key text,
  payload_hash text,
  status text not null default 'received'
    check (status in (
      'received','authorized','approval_pending','executing','succeeded',
      'denied','rate_limited','failed','cancelled'
    )),
  external_id text,
  result_metadata jsonb not null default '{}'::jsonb,
  error_code text,
  error_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (payload_hash is null or payload_hash ~ '^[0-9a-f]{64}$')
);

create unique index agent_gateway_operations_idempotency_idx
  on public.agent_gateway_operations(workspace_id, agent_id, action, idempotency_key)
  where idempotency_key is not null;

create table public.agent_audit_log (
  id bigint generated always as identity primary key,
  request_id uuid not null,
  operation_id uuid references public.agent_gateway_operations(id) on delete set null,
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  agent_id uuid not null references public.agents(id) on delete restrict,
  credential_id uuid references public.agent_api_credentials(id) on delete set null,
  action text not null,
  resource_type text,
  resource_id text,
  status text not null
    check (status in ('succeeded','denied','rate_limited','failed')),
  http_status integer not null check (http_status between 100 and 599),
  duration_ms integer not null check (duration_ms >= 0),
  input_summary jsonb not null default '{}'::jsonb,
  approval_request_id uuid,
  error_code text,
  error_summary text,
  source_ip inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create table public.agent_rate_limit_buckets (
  credential_id uuid not null references public.agent_api_credentials(id) on delete cascade,
  action text not null,
  bucket_start timestamptz not null,
  window_seconds integer not null check (window_seconds between 1 and 3600),
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (credential_id, action, bucket_start, window_seconds)
);

create index agent_api_credentials_active_hash_idx
  on public.agent_api_credentials(token_hash)
  where revoked_at is null;

create index agent_api_credentials_agent_workspace_idx
  on public.agent_api_credentials(agent_id, workspace_id);

create index agent_permissions_agent_enabled_idx
  on public.agent_permissions(agent_id, action)
  where enabled;

create index agent_gateway_operations_agent_created_idx
  on public.agent_gateway_operations(workspace_id, agent_id, created_at desc);

create index agent_audit_log_agent_created_idx
  on public.agent_audit_log(workspace_id, agent_id, created_at desc);

create index agent_audit_log_action_created_idx
  on public.agent_audit_log(action, created_at desc);

create index agent_rate_limit_buckets_updated_idx
  on public.agent_rate_limit_buckets(updated_at);

drop trigger if exists agent_api_credentials_set_updated_at on public.agent_api_credentials;
create trigger agent_api_credentials_set_updated_at
before update on public.agent_api_credentials
for each row execute function public.update_updated_at_column();

drop trigger if exists agent_permissions_set_updated_at on public.agent_permissions;
create trigger agent_permissions_set_updated_at
before update on public.agent_permissions
for each row execute function public.update_updated_at_column();

drop trigger if exists agent_gateway_operations_set_updated_at on public.agent_gateway_operations;
create trigger agent_gateway_operations_set_updated_at
before update on public.agent_gateway_operations
for each row execute function public.update_updated_at_column();

alter table public.agent_api_credentials enable row level security;
alter table public.agent_permissions enable row level security;
alter table public.agent_gateway_operations enable row level security;
alter table public.agent_audit_log enable row level security;
alter table public.agent_rate_limit_buckets enable row level security;

revoke all on public.agent_api_credentials from public, anon, authenticated;
revoke all on public.agent_permissions from public, anon, authenticated;
revoke all on public.agent_gateway_operations from public, anon, authenticated;
revoke all on public.agent_audit_log from public, anon, authenticated;
revoke all on public.agent_rate_limit_buckets from public, anon, authenticated;

grant all on public.agent_api_credentials to service_role;
grant all on public.agent_permissions to service_role;
grant all on public.agent_gateway_operations to service_role;
grant select, insert on public.agent_audit_log to service_role;
grant all on public.agent_rate_limit_buckets to service_role;
grant usage, select on sequence public.agent_audit_log_id_seq to service_role;

create or replace function public.agent_gateway_consume_rate_limit(
  _credential_id uuid,
  _action text,
  _max_requests integer,
  _window_seconds integer default 60
)
returns table (
  allowed boolean,
  remaining integer,
  reset_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  _bucket_start timestamptz;
  _count integer;
begin
  if _max_requests < 1 or _max_requests > 10000 then
    raise exception 'Invalid rate limit';
  end if;
  if _window_seconds < 1 or _window_seconds > 3600 then
    raise exception 'Invalid rate-limit window';
  end if;

  _bucket_start := to_timestamp(
    floor(extract(epoch from clock_timestamp()) / _window_seconds) * _window_seconds
  );

  insert into public.agent_rate_limit_buckets (
    credential_id, action, bucket_start, window_seconds, request_count
  )
  values (_credential_id, _action, _bucket_start, _window_seconds, 1)
  on conflict (credential_id, action, bucket_start, window_seconds)
  do update
    set request_count = public.agent_rate_limit_buckets.request_count + 1,
        updated_at = now()
  returning request_count into _count;

  return query
    select
      _count <= _max_requests,
      greatest(_max_requests - _count, 0),
      _bucket_start + make_interval(secs => _window_seconds);
end;
$$;

revoke all on function public.agent_gateway_consume_rate_limit(uuid, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.agent_gateway_consume_rate_limit(uuid, text, integer, integer)
  to service_role;

-- Register Ema without altering an existing customized record.
insert into public.agents (
  name, slug, emoji, subtitle, role, type, status, skills, position
)
values (
  'Ema',
  'ema',
  '📧',
  'Email, deal intake, and CRM operations',
  'Communications + intake + CRM',
  'ai',
  'offline',
  array['email','deal-intake','crm']::text[],
  30
)
on conflict (slug) do nothing;

-- Read-only milestone permissions. No draft, send, CRM write, approval, or
-- unrestricted database capability is enabled here.
insert into public.agent_permissions (
  agent_id, action, enabled, rate_limit_per_minute
)
select
  a.id,
  permission.action,
  true,
  permission.rate_limit_per_minute
from public.agents a
cross join (
  values
    ('system.whoami', 30),
    ('email.list', 60),
    ('email.search', 30),
    ('email.read', 120),
    ('email.get_attachment', 30)
) as permission(action, rate_limit_per_minute)
where a.slug = 'ema'
on conflict (agent_id, action)
do update set
  enabled = excluded.enabled,
  rate_limit_per_minute = excluded.rate_limit_per_minute,
  updated_at = now();

comment on table public.agent_api_credentials is
  'Revocable per-agent Gateway credentials. Stores hashes only, never raw tokens.';
comment on table public.agent_permissions is
  'Exact capability allowlist for each autonomous agent.';
comment on table public.agent_gateway_operations is
  'Idempotent state for Gateway actions that may produce external effects.';
comment on table public.agent_audit_log is
  'Append-only security audit trail for authenticated Gateway requests.';
comment on table public.agent_rate_limit_buckets is
  'Atomic fixed-window counters used by the Agent Gateway.';
