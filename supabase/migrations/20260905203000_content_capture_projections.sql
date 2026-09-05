-- Content capture projections.
--
-- Step 3 of the Marquetta build order: the read side of lane 1. These are the
-- only windows a content agent gets onto business data, and they are
-- projections, never table access.
--
-- WHAT IS DELIBERATELY WITHHELD, and why it is withheld here rather than asked
-- for politely in a skill prompt:
--
--   Street addresses. A "just got this under contract" post does not need the
--   house number, and many of these sellers are in distress or transition.
--   City and state give the story; the street exposes a private individual who
--   never agreed to appear in marketing. City/state only, always.
--
--   Contacts. No contact, lead or company ids, no names. A content agent has no
--   business resolving a person.
--
--   Deal economics. MAO, asking price, our_value, spread, repair estimates,
--   cap rates, broker feedback, lost reasons. These are negotiating positions.
--   An agent cannot leak a number it was never given, and no content angle is
--   worth handing the buy side our math.
--
--   Raw task context and result. Completed agent_tasks routinely carry
--   engineering detail, financials, security material and internal strategy.
--   Only tasks explicitly flagged content_capture_eligible are visible at all,
--   and even those return title plus a truncated summary rather than the raw
--   columns.
--
-- What is left is what a content seed actually needs: something real happened, here
-- is roughly where and what kind, on this date.

create or replace function content_capture_list_deal_events(
  p_agent_slug text,
  p_workspace_id uuid,
  p_since timestamptz default now() - interval '30 days',
  p_limit integer default 25
)
returns table (
  source_ref text,
  headline text,
  property_city text,
  property_state text,
  property_type text,
  units integer,
  disposition_strategy text,
  stage_name text,
  occurred_at timestamptz
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
    'deal:' || d.id::text,
    -- Title only. Deal titles are internal shorthand, so the agent still has to
    -- write the post; this is a prompt, not copy.
    d.title,
    d.property_city,
    d.property_state,
    d.property_type,
    d.units,
    d.disposition_strategy,
    s.name,
    coalesce(d.stage_entered_at, d.updated_at, d.created_at)
  from deals d
  left join pipeline_stages s on s.id = d.stage_id
  where d.workspace_id = p_workspace_id
    and coalesce(d.stage_entered_at, d.updated_at, d.created_at) >= p_since
    -- Only milestones worth talking about, and never a lost deal: "we lost this
    -- one" is a story the seller did not consent to either.
    and d.status = 'open'
    and s.name is not null
  order by coalesce(d.stage_entered_at, d.updated_at, d.created_at) desc
  limit p_limit;
end;
$fn$;

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
    'content_capture_list_deal_events(text, uuid, timestamptz, integer)',
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
