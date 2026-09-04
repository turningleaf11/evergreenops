-- Follow-up hardening discovered during post-deploy verification.
-- No Gateway credential or audit event existed when this migration was created.

update public.agent_permissions p
set
  rate_limit_per_minute = limits.rate_limit_per_minute,
  updated_at = now()
from public.agents a
join (
  values
    ('email.list', 12),
    ('email.search', 20),
    ('email.read', 60),
    ('email.get_attachment', 20),
    ('system.whoami', 30)
) as limits(action, rate_limit_per_minute) on true
where p.agent_id = a.id
  and a.slug = 'ema'
  and p.action = limits.action;

alter table public.agent_audit_log
  add constraint agent_audit_log_request_id_key unique (request_id);

alter table public.agent_audit_log
  drop constraint agent_audit_log_operation_id_fkey,
  add constraint agent_audit_log_operation_id_fkey
    foreign key (operation_id)
    references public.agent_gateway_operations(id)
    on delete restrict;

alter table public.agent_audit_log
  drop constraint agent_audit_log_credential_id_fkey,
  add constraint agent_audit_log_credential_id_fkey
    foreign key (credential_id)
    references public.agent_api_credentials(id)
    on delete restrict;

comment on constraint agent_audit_log_request_id_key
  on public.agent_audit_log is
  'Each Gateway request produces at most one final security audit event.';
;
