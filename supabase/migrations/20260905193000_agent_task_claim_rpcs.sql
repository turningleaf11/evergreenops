-- Agent task claim / result RPCs.
--
-- Step 2 of the Marquetta build order. These are the only way an agent touches
-- agent_tasks: no direct select, no direct update, no caller-supplied identity
-- beyond the slug the Gateway already authenticated.
--
-- Two properties have to hold in the database rather than in a skill prompt,
-- because a prompt is a suggestion and these are not:
--
--   1. ATOMIC CLAIM. Cron runs overlap. Two heartbeats that fire together must
--      never work the same task. The claim uses FOR UPDATE SKIP LOCKED and
--      takes a time-boxed lease, so a crashed agent's task returns to the queue
--      on its own instead of being stuck forever.
--
--   2. STATUS CEILING. An agent may reach 'review' or 'blocked' and nothing
--      else. 'approved' fires a real GitHub Actions build and 'done' closes
--      work nobody checked -- both are a human's call. Attempting either raises,
--      regardless of what the agent's skill file says or what a compromised
--      prompt talks it into.
--
-- Written generically over agents.slug rather than for Marquetta specifically,
-- so Cash, Ema and Dex can move onto the same claim path later.

alter table agent_tasks
  add column if not exists leased_by text,
  add column if not exists leased_until timestamptz,
  add column if not exists lease_count integer not null default 0;

create index if not exists agent_tasks_claimable_idx
  on agent_tasks (assigned_to, status, created_at)
  where archived is not true;

-- Statuses an agent may pick work up from.
create or replace function agent_task_claimable_statuses()
returns text[] language sql immutable as $$
  select array['todo', 'backlog', 'pending', 'needs_input']::text[]
$$;

-- ---------------------------------------------------------------------------
-- Claim the next task for an agent.
--
-- Returns zero rows when there is no work -- callers must treat that as normal,
-- not as an error. Re-claims a task the same agent already holds so a resumed
-- run continues rather than starting a second one.
-- ---------------------------------------------------------------------------
create or replace function agent_task_claim_next(
  p_agent_slug text,
  p_workspace_id uuid,
  p_lease_seconds integer default 900
)
returns table (
  task_id uuid,
  title text,
  description text,
  task_type text,
  context jsonb,
  priority text,
  leased_until timestamptz
)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_agent_enabled boolean;
begin
  if p_lease_seconds is null or p_lease_seconds < 60 or p_lease_seconds > 7200 then
    raise exception 'lease seconds must be between 60 and 7200, got %', p_lease_seconds;
  end if;

  select enabled into v_agent_enabled from agents where slug = p_agent_slug;
  if v_agent_enabled is null then
    raise exception 'unknown agent slug %', p_agent_slug;
  end if;
  -- A disabled agent is the kill switch. It must stop claiming immediately,
  -- without needing its container stopped or its credential revoked.
  if not v_agent_enabled then
    return;
  end if;

  return query
  with claimed as (
    update agent_tasks t
       set status = 'in_progress',
           leased_by = p_agent_slug,
           leased_until = now() + make_interval(secs => p_lease_seconds),
           lease_count = t.lease_count + 1,
           started_at = coalesce(t.started_at, now()),
           updated_at = now()
     where t.id = (
       select c.id
         from agent_tasks c
        where c.assigned_to = p_agent_slug
          and c.workspace_id = p_workspace_id
          and c.archived is not true
          and (
            c.status = any (agent_task_claimable_statuses())
            -- Reclaim in-flight work only once its lease has lapsed. A live
            -- lease is never re-handed out, not even to the agent already
            -- holding it: doing so returns the same task forever and the agent
            -- never reaches its second one. Crash recovery is the lease
            -- expiring, which is what the lease is for.
            or (c.status = 'in_progress'
                and (c.leased_until is null or c.leased_until < now()))
          )
          and (c.deferred_until is null or c.deferred_until <= now())
        order by
          case c.priority when 'urgent' then 0 when 'high' then 1
                          when 'medium' then 2 else 3 end,
          c.created_at
        for update skip locked
        limit 1
     )
    returning t.id, t.title, t.description, t.type, t.context, t.priority, t.leased_until
  )
  select * from claimed;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- Submit a result and hand the task back.
--
-- p_status is constrained to 'review' or 'blocked' by the function itself. The
-- parameter exists so the agent can distinguish "done, needs a human" from
-- "I cannot proceed" -- not so it can choose any status.
-- ---------------------------------------------------------------------------
create or replace function agent_task_submit_result(
  p_agent_slug text,
  p_workspace_id uuid,
  p_task_id uuid,
  p_result text,
  p_status text default 'review',
  p_error text default null
)
returns text
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_task agent_tasks%rowtype;
  v_agent agents%rowtype;
begin
  if p_status not in ('review', 'blocked') then
    raise exception
      'agents may only submit review or blocked, not %. approved and done are a human decision.',
      p_status;
  end if;

  if p_result is null or length(btrim(p_result)) = 0 then
    raise exception 'a result is required; an empty result is not a completed task';
  end if;

  -- Bound the write. A runaway agent should not be able to push unbounded text
  -- into the task row.
  if length(p_result) > 20000 then
    raise exception 'result exceeds 20000 characters (got %)', length(p_result);
  end if;

  select * into v_agent from agents where slug = p_agent_slug;
  if not found then
    raise exception 'unknown agent slug %', p_agent_slug;
  end if;

  select * into v_task
    from agent_tasks
   where id = p_task_id
     and workspace_id = p_workspace_id
   for update;

  if not found then
    raise exception 'task % not found in this workspace', p_task_id;
  end if;

  -- Identity is checked against the lease, not against a caller-supplied claim,
  -- so one agent cannot close another's work.
  if v_task.leased_by is distinct from p_agent_slug then
    raise exception 'task % is not leased by %', p_task_id, p_agent_slug;
  end if;

  if v_task.status in ('approved', 'done', 'cancelled') then
    raise exception 'task % is already %, refusing to reopen it', p_task_id, v_task.status;
  end if;

  update agent_tasks
     set status = p_status,
         result = p_result,
         error = p_error,
         completed_at = case when p_status = 'review' then now() else completed_at end,
         leased_by = null,
         leased_until = null,
         updated_at = now()
   where id = p_task_id;

  -- Persistence is mandatory: a result that exists only in a model's output did
  -- not happen. The task row and the log are written here, together, so an agent
  -- cannot report success without leaving a trace.
  insert into ai_logs (task_id, agent_id, agent_name, agent_emoji, category, message)
  values (
    p_task_id,
    v_agent.id,
    v_agent.name,
    v_agent.emoji,
    case when p_status = 'blocked' then 'blocked' else 'result' end,
    left(p_result, 2000)
  );

  return p_status;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- Extend a lease on long work, so a slow-but-alive agent does not have its task
-- reclaimed underneath it.
-- ---------------------------------------------------------------------------
create or replace function agent_task_extend_lease(
  p_agent_slug text,
  p_workspace_id uuid,
  p_task_id uuid,
  p_lease_seconds integer default 900
)
returns timestamptz
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_until timestamptz;
begin
  if p_lease_seconds is null or p_lease_seconds < 60 or p_lease_seconds > 7200 then
    raise exception 'lease seconds must be between 60 and 7200, got %', p_lease_seconds;
  end if;

  update agent_tasks
     set leased_until = now() + make_interval(secs => p_lease_seconds),
         updated_at = now()
   where id = p_task_id
     and workspace_id = p_workspace_id
     and leased_by = p_agent_slug
  returning leased_until into v_until;

  if v_until is null then
    raise exception 'task % is not leased by %', p_task_id, p_agent_slug;
  end if;

  return v_until;
end;
$fn$;

-- These run as the Gateway (service role) only. No anon/authenticated grant:
-- the app talks to agent_tasks directly under RLS, agents go through the
-- Gateway, and nothing else should be able to claim agent work.
-- Guarded so the migration also runs against a bare Postgres in tests, where
-- Supabase's anon/authenticated roles do not exist.
do $revoke$
declare
  v_fn text;
  v_role text;
begin
  foreach v_fn in array array[
    'agent_task_claim_next(text, uuid, integer)',
    'agent_task_submit_result(text, uuid, uuid, text, text, text)',
    'agent_task_extend_lease(text, uuid, uuid, integer)'
  ] loop
    execute format('revoke all on function %s from public', v_fn);
    foreach v_role in array array['anon', 'authenticated'] loop
      if exists (select 1 from pg_roles where rolname = v_role) then
        execute format('revoke all on function %s from %I', v_fn, v_role);
      end if;
    end loop;
  end loop;
end;
$revoke$;
