-- Ema-only, read-only HighLevel capabilities for duplicate detection and
-- pipeline routing. No credential is created and no mutation action is added.
insert into public.agent_permissions (
  agent_id,
  action,
  enabled,
  rate_limit_per_minute
)
select
  a.id,
  permission.action,
  true,
  permission.rate_limit_per_minute
from public.agents a
cross join (
  values
    ('crm.search_contacts', 30),
    ('crm.search_opportunities', 30),
    ('crm.list_pipelines', 10)
) as permission(action, rate_limit_per_minute)
where a.slug = 'ema'
on conflict (agent_id, action) do update
set
  enabled = excluded.enabled,
  rate_limit_per_minute = excluded.rate_limit_per_minute,
  updated_at = now();
