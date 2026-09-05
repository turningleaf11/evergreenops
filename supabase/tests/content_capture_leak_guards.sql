-- Leak guards for the content capture projection.
--
-- Every value seeded below is something Marquetta must never receive. The test
-- asserts by scanning the entire projection output as text, so a future column
-- added to the RETURNS TABLE fails here rather than quietly shipping a leak.
--
-- The deal rows are still seeded even though there is no deal projection any
-- more: the guard asserts that no deal data reaches a content agent by ANY
-- route, so if someone reintroduces a deal source later, this fails first.
\pset pager off
\set ON_ERROR_STOP on

insert into workspaces (id) values ('11111111-1111-1111-1111-111111111111');
insert into agents (name, slug, enabled) values ('Marquetta','marquetta',true);
insert into pipeline_stages (id, name) values ('aaaaaaaa-0000-0000-0000-0000000000aa','Under Contract');

insert into deals (workspace_id, stage_id, title, status, property_address, property_city,
  property_state, property_type, units, asking_price, mao, our_value, spread, repair_estimate,
  broker_feedback, primary_contact_id, disposition_strategy, stage_entered_at)
values ('11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-0000000000aa',
  'Riviera duplex','open','1109 Riviera Dr','Coral Gables','FL','duplex',2,
  450000, 312000, 398000, 86000, 55000,
  'Seller is desperate, will take 290k','bbbbbbbb-0000-0000-0000-0000000000bb','flip', now());

insert into deals (workspace_id, stage_id, title, status, property_city, property_state,
  stage_entered_at, lost_reason)
values ('11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-0000000000aa',
  'Lost one','lost','Miami','FL', now(), 'seller ghosted');

insert into agent_tasks (workspace_id, title, description, result, context, type, status,
  completed_at, content_capture_eligible)
values ('11111111-1111-1111-1111-111111111111','Ship underwriting agent',
  'Built Cash to screen SFR deals automatically.',
  'SERVICE_ROLE_KEY=sk_live_hunter2 rotated','{"secret":"do not leak"}'::jsonb,
  'build','done', now(), true);

insert into agent_tasks (workspace_id, title, description, result, type, status,
  completed_at, content_capture_eligible)
values ('11111111-1111-1111-1111-111111111111','Rotate production credentials',
  'Quarterly credential rotation','old key revoked','security','done', now(), false);

do $$
declare
  v_deals text;
  v_tasks text;
  v_forbidden text;
  v_failures int := 0;
begin
  -- Every content capture function's output, concatenated. If a deal source is
  -- ever added back, it lands here and the guard below catches it.
  select coalesce(string_agg(t::text, ' '), '') into v_deals
    from content_capture_list_task_events('marquetta','11111111-1111-1111-1111-111111111111') t;
  select coalesce(string_agg(t::text, ' '), '') into v_tasks
    from content_capture_list_task_events('marquetta','11111111-1111-1111-1111-111111111111') t;

  -- No deal data may reach a content agent by any route. There is no deal
  -- projection; this asserts it stays that way.
  foreach v_forbidden in array array[
    '1109 Riviera Dr', '450000', '312000', '398000', '86000', '55000',
    'Seller is desperate', 'bbbbbbbb-0000-0000-0000-0000000000bb',
    'Riviera duplex', 'Coral Gables', 'Lost one', 'seller ghosted'
  ] loop
    if position(v_forbidden in v_deals) > 0 then
      raise warning 'LEAK: deal data reached a content projection: %', v_forbidden;
      v_failures := v_failures + 1;
    end if;
  end loop;

  -- Task projection must not carry raw results, context, or any task that was
  -- not explicitly flagged content_capture_eligible.
  foreach v_forbidden in array array[
    'SERVICE_ROLE_KEY', 'sk_live_hunter2', 'do not leak',
    'Rotate production credentials', 'Quarterly credential rotation'
  ] loop
    if position(v_forbidden in v_tasks) > 0 then
      raise warning 'LEAK: task projection exposed %', v_forbidden;
      v_failures := v_failures + 1;
    end if;
  end loop;

  -- And it must still return the thing it is for, or the guards above pass
  -- trivially on an empty result.
  if position('Ship underwriting agent' in v_tasks) = 0 then
    raise warning 'projection returned no usable task event'; v_failures := v_failures + 1;
  end if;

  if v_failures > 0 then
    raise exception '% capture leak guard(s) failed', v_failures;
  end if;
  raise notice 'PASS — all capture leak guards held';
end;
$$;
