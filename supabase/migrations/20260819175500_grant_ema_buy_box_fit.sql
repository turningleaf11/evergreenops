do $$
declare
  ema_agent_id uuid;
begin
  select id
    into strict ema_agent_id
  from public.agents
  where slug = 'ema';

  delete from public.agent_permissions
  where action = 'deal.buy_box_fit'
    and agent_id <> ema_agent_id;

  insert into public.agent_permissions (
    agent_id,
    action,
    enabled,
    rate_limit_per_minute,
    updated_at
  ) values (
    ema_agent_id,
    'deal.buy_box_fit',
    true,
    6,
    now()
  )
  on conflict (agent_id, action) do update
    set enabled = excluded.enabled,
        rate_limit_per_minute = excluded.rate_limit_per_minute,
        updated_at = now();
end
$$;
