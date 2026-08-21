-- Give Ema a narrow, auditable capability to persist a real Gmail message and
-- its source-backed property candidates before buy-box qualification.
-- No other agent receives this permission.

do $$
declare
  ema_agent_id uuid;
begin
  select id into strict ema_agent_id
  from public.agents
  where slug = 'ema';

  delete from public.agent_permissions
  where action = 'deal.persist_email_intake'
    and agent_id <> ema_agent_id;

  insert into public.agent_permissions (
    agent_id, action, enabled, rate_limit_per_minute
  ) values (
    ema_agent_id, 'deal.persist_email_intake', true, 8
  )
  on conflict (agent_id, action) do update
  set enabled = excluded.enabled,
      rate_limit_per_minute = excluded.rate_limit_per_minute;
end $$;
