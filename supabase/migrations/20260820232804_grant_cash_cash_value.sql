do $$
declare
  cash_agent_id uuid;
begin
  select id
    into strict cash_agent_id
  from public.agents
  where slug = 'cash';

  delete from public.agent_permissions
  where action = 'underwriting.cash_value'
    and agent_id <> cash_agent_id;

  insert into public.agent_permissions (
    agent_id,
    action,
    enabled,
    rate_limit_per_minute,
    updated_at
  ) values (
    cash_agent_id,
    'underwriting.cash_value',
    true,
    12,
    now()
  )
  on conflict (agent_id, action) do update
    set enabled = excluded.enabled,
        rate_limit_per_minute = excluded.rate_limit_per_minute,
        updated_at = now();
end
$$;;
