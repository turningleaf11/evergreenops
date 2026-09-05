-- Marquetta's Gateway capability grants.
--
-- Step 5 of the build order. Capabilities are exact named actions, never roles:
-- a grant for one action gives no implicit access to a neighbouring one, and
-- the Gateway requires an exact match.
--
-- These rows are enabled, but the `agents` row for marquetta is still disabled
-- (20260905200000), so nothing can actually run yet. That ordering is
-- deliberate — the permission set can be reviewed and audited in place before
-- the agent is ever allowed to act, and enabling her later is one flag rather
-- than a scramble to grant things under pressure.
--
-- WHAT IS NOT GRANTED, and must stay that way:
--   email.*         Ema's. Marquetta has no inbox.
--   crm.*           Ema's. Not "no CRM write" — no CRM capability at all in v1.
--                   The capture feed supplies what she needs without exposing
--                   the CRM surface.
--   deal.*          Removed by design. A deal post is Autumn's to start.
--   underwriting.*  Cash's.
--   content.brands write  A brand row holds the voice, audience and mission
--                   that govern her. Editing it is editing her own policy.
--   publishing      Meta and LinkedIn credentials live with the publish worker.
--                   She schedules; the worker posts.
--   ai_logs write   The task RPC already mirrors lifecycle into ai_logs. There
--                   is no reason to hand a model an arbitrary log writer.
--
-- Rate limits are sized for an hourly duty cycle with room for a backlog, not
-- for a runaway loop. Writes are tighter than reads on purpose: a bug that
-- reads too much wastes time, a bug that writes too much fills the review queue
-- with rubbish that a human then has to wade through.

do $$
declare
  v_agent_id uuid;
  v_action text;
  v_limit integer;
  v_grants text[][] := array[
    -- action                                rate limit per minute
    array['system.whoami',                    '10'],
    array['agent_tasks.next_assigned',        '30'],
    array['agent_tasks.submit_result',        '30'],
    array['content.capture.list_task_events', '20'],
    array['content.brands.read',              '20'],
    array['content.pillars.list',             '20'],
    array['content.seeds.list',               '30'],
    array['content.seeds.save',               '20'],
    array['content.research.list',            '20'],
    array['content.research.save',            '10'],
    array['content.library.list',             '30'],
    array['content.library.save_draft',       '20'],
    array['content.voice_exemplars.list',     '20'],
    array['content.voice_exemplars.propose',  '10'],
    array['content.schedule.list',            '20'],
    array['content.schedule.propose',         '20']
  ];
begin
  select id into v_agent_id from agents where slug = 'marquetta';
  if v_agent_id is null then
    raise exception 'marquetta agent row is missing; run 20260905200000 first';
  end if;

  for i in 1 .. array_length(v_grants, 1) loop
    v_action := v_grants[i][1];
    v_limit := v_grants[i][2]::integer;
    insert into agent_permissions (agent_id, action, enabled, rate_limit_per_minute)
    values (v_agent_id, v_action, true, v_limit)
    on conflict (agent_id, action)
      do update set enabled = true, rate_limit_per_minute = excluded.rate_limit_per_minute, updated_at = now();
  end loop;

  -- Fail loudly rather than silently under-granting. A missing capability at
  -- runtime looks like a broken agent and costs an afternoon to trace.
  if (select count(*) from agent_permissions where agent_id = v_agent_id and enabled) <> array_length(v_grants, 1) then
    raise exception 'expected % enabled permissions for marquetta, found %',
      array_length(v_grants, 1),
      (select count(*) from agent_permissions where agent_id = v_agent_id and enabled);
  end if;
end;
$$;
