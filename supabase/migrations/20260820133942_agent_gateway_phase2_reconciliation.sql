-- Phase 2: durable reply/document reconciliation for Ema.
-- A later Gmail message may enrich an existing candidate without creating a
-- duplicate candidate or opportunity. Source linkage and document inventory
-- stay auditable and workspace-scoped.

create table if not exists public.ema_candidate_sources (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  ema_candidate_id uuid not null references public.ema_candidates(id) on delete cascade,
  ema_message_id uuid not null references public.ema_messages(id) on delete cascade,
  relation_type text not null
    check (relation_type in ('origin','thread_reply','address_match')),
  fact_updates jsonb not null default '{}'::jsonb
    check (jsonb_typeof(fact_updates) = 'object'),
  reconciliation_metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(reconciliation_metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ema_candidate_id, ema_message_id)
);

create table if not exists public.ema_candidate_documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  ema_candidate_id uuid not null references public.ema_candidates(id) on delete cascade,
  ema_message_id uuid not null references public.ema_messages(id) on delete cascade,
  gmail_attachment_id text not null,
  filename text not null,
  mime_type text,
  document_type text not null
    check (document_type in ('om','rent_roll','t12','pnl')),
  created_at timestamptz not null default now(),
  unique (ema_candidate_id, ema_message_id, gmail_attachment_id)
);

create index if not exists ema_candidate_sources_candidate_idx
  on public.ema_candidate_sources(workspace_id, ema_candidate_id, created_at desc);
create index if not exists ema_candidate_sources_message_idx
  on public.ema_candidate_sources(ema_message_id);
create index if not exists ema_candidate_documents_candidate_idx
  on public.ema_candidate_documents(workspace_id, ema_candidate_id, document_type);

insert into public.ema_candidate_sources (
  workspace_id, ema_candidate_id, ema_message_id, relation_type,
  reconciliation_metadata
)
select c.workspace_id, c.id, c.ema_message_id, 'origin',
       jsonb_build_object('backfilled', true)
from public.ema_candidates c
on conflict (ema_candidate_id, ema_message_id) do nothing;

create trigger ema_candidate_sources_set_updated_at
before update on public.ema_candidate_sources
for each row execute function public.update_updated_at_column();

alter table public.ema_candidate_sources enable row level security;
alter table public.ema_candidate_documents enable row level security;

create policy "Workspace admins can view Ema candidate sources"
on public.ema_candidate_sources for select to authenticated
using (
  public.has_role(auth.uid(), 'admin')
  and workspace_id in (
    select p.workspace_id from public.profiles p where p.user_id = auth.uid()
  )
);

create policy "Workspace admins can view Ema candidate documents"
on public.ema_candidate_documents for select to authenticated
using (
  public.has_role(auth.uid(), 'admin')
  and workspace_id in (
    select p.workspace_id from public.profiles p where p.user_id = auth.uid()
  )
);

revoke all on public.ema_candidate_sources from anon, authenticated;
revoke all on public.ema_candidate_documents from anon, authenticated;
grant select on public.ema_candidate_sources to authenticated;
grant select on public.ema_candidate_documents to authenticated;
grant all on public.ema_candidate_sources to service_role;
grant all on public.ema_candidate_documents to service_role;

comment on table public.ema_candidate_sources is
  'Auditable Gmail source messages associated with an existing Ema candidate.';
comment on table public.ema_candidate_documents is
  'Source-backed OM, rent roll, T12, and P&L attachments associated with Ema candidates.';

do $$
declare
  ema_agent_id uuid;
begin
  select id into strict ema_agent_id from public.agents where slug = 'ema';

  delete from public.agent_permissions
  where action = 'deal.reconcile_email_update'
    and agent_id <> ema_agent_id;

  insert into public.agent_permissions (
    agent_id, action, enabled, rate_limit_per_minute
  ) values (
    ema_agent_id, 'deal.reconcile_email_update', true, 8
  )
  on conflict (agent_id, action) do update
  set enabled = excluded.enabled,
      rate_limit_per_minute = excluded.rate_limit_per_minute;
end $$;;
