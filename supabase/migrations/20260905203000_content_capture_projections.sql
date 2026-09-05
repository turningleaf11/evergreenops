-- Content capture projections.
--
-- Step 3 of the Marquetta build order: the read side of lane 1. This is the
-- only window a content agent gets onto business data, and it is a projection,
-- never table access.
--
-- NO DEAL PROJECTION, deliberately. An earlier draft exposed sanitized deal
-- milestones as a seed source. Autumn's call, and correct: a post about a deal
-- is something she knows before any table does, and the sanitized row a content
-- agent could safely be shown -- "duplex, Coral Gables, Under Contract" -- is a
-- stub she would have to write the whole post around anyway. It bought nothing
-- and cost a standing window onto deal data. A deal can still become content
-- through a MANUAL seed, written by a human who knows what is shareable; that
-- judgement is not automatable and should not be automated. The live pipeline
-- lives in HighLevel regardless.
--
-- WHAT IS WITHHELD FROM THE TASK PROJECTION, and why it is withheld here rather
-- than asked for politely in a skill prompt:
--
--   Raw task context and result. Completed agent_tasks routinely carry
--   engineering detail, financials, security material and internal strategy.
--   Only tasks explicitly flagged content_capture_eligible are visible at all,
--   and even those return title plus a truncated description rather than the
--   raw columns.
--
-- What is left is what a content seed actually needs: something real shipped,
-- here is what it was, on this date.

create or replace function content_capture_list_task_events(
  p_agent_slug text,
  p_workspace_id uuid,
  p_since timestamptz default now() - interval '30 days',
  p_limit integer default 25
)
returns table (
  source_ref text,
  headline text,
  task_type text,
  summary text,
  completed_at timestamptz
)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_enabled boolean;
begin
  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'limit must be between 1 and 100, got %', p_limit;
  end if;

  select enabled into v_enabled from agents where slug = p_agent_slug;
  if v_enabled is null then
    raise exception 'unknown agent slug %', p_agent_slug;
  end if;
  if not v_enabled then
    return;
  end if;

  return query
  select
    'task:' || t.id::text,
    t.title,
    t.type,
    -- Truncated, and from description rather than result: the description says
    -- what was intended, the result often contains the working detail. Opt-in
    -- via content_capture_eligible is the gate; this is the second belt.
    left(coalesce(t.description, ''), 500),
    t.completed_at
  from agent_tasks t
  where t.workspace_id = p_workspace_id
    and t.content_capture_eligible is true
    and t.status in ('done', 'approved')
    and t.completed_at is not null
    and t.completed_at >= p_since
    and t.archived is not true
  order by t.completed_at desc
  limit p_limit;
end;
$fn$;

-- Gateway (service role) only, same as the task RPCs. Guarded so this also runs
-- against a bare Postgres in tests.
do $revoke$
declare
  v_fn text;
  v_role text;
begin
  foreach v_fn in array array[
    'content_capture_list_task_events(text, uuid, timestamptz, integer)'
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
