-- Ema durable mailbox-processing state.
-- External actions remain controlled by the Ema runtime; this migration creates
-- persistence and idempotency boundaries only.

create table public.ema_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  gmail_account text not null,
  gmail_message_id text not null,
  gmail_thread_id text not null,
  supersedes_message_id uuid references public.ema_messages(id) on delete set null,
  sender_email text,
  sender_name text,
  recipient_addresses jsonb not null default '[]'::jsonb,
  subject text,
  received_at timestamptz,
  processing_status text not null default 'pending'
    check (processing_status in (
      'pending','claimed','extracted','partially_processed','completed','excluded','error'
    )),
  raw_metadata jsonb not null default '{}'::jsonb,
  is_test boolean not null default false,
  test_run_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, gmail_account, gmail_message_id),
  check (not is_test or test_run_id is not null)
);

create table public.ema_candidates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  ema_message_id uuid not null references public.ema_messages(id) on delete cascade,
  parent_candidate_id uuid references public.ema_candidates(id) on delete set null,
  candidate_index integer not null check (candidate_index >= 0),
  candidate_type text,
  normalized_address text,
  candidate_fingerprint text not null,
  extracted_facts jsonb not null default '{}'::jsonb,
  evidence jsonb not null default '{}'::jsonb,
  missing_information jsonb not null default '[]'::jsonb,
  source_type text,
  intake_result text
    check (intake_result is null or intake_result in (
      'supported','excluded','needs_classification','needs_info'
    )),
  cash_screen_result text not null default 'not_requested'
    check (cash_screen_result in (
      'pending','pass','marginal','needs_info','fail','not_requested'
    )),
  ghl_readiness text not null default 'not_evaluated'
    check (ghl_readiness in (
      'not_evaluated','ready','needs_info','excluded','duplicate'
    )),
  cash_task_id uuid references public.agent_tasks(id) on delete set null,
  ghl_contact_id text,
  ghl_opportunity_id text,
  processing_status text not null default 'extracted'
    check (processing_status in (
      'extracted','intake_excluded','screen_pending','screen_passed',
      'screen_marginal','screen_needs_info','screen_failed','ghl_pending',
      'completed','error'
    )),
  last_evaluated_at timestamptz,
  cash_screened_at timestamptz,
  is_test boolean not null default false,
  test_run_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ema_message_id, candidate_index),
  check (not is_test or test_run_id is not null)
);

create table public.ema_operations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  ema_message_id uuid references public.ema_messages(id) on delete cascade,
  ema_candidate_id uuid references public.ema_candidates(id) on delete cascade,
  operating_mode text not null
    check (operating_mode in ('shadow','assisted','autonomous')),
  operation_type text not null
    check (operation_type in (
      'cash_task_create','ghl_contact_upsert','ghl_opportunity_create',
      'ghl_opportunity_update','ghl_opportunity_note_create',
      'gmail_draft_create','gmail_label_apply','gmail_mark_read'
    )),
  idempotency_key text not null,
  operation_status text not null default 'pending'
    check (operation_status in (
      'simulated','pending','executing','succeeded','retryable_error',
      'permanent_error','needs_reconciliation','cancelled'
    )),
  external_id text,
  request_metadata jsonb not null default '{}'::jsonb,
  result_metadata jsonb not null default '{}'::jsonb,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error text,
  is_test boolean not null default false,
  test_run_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, operating_mode, idempotency_key),
  check (ema_message_id is not null or ema_candidate_id is not null),
  check (not is_test or test_run_id is not null)
);

create table public.ema_errors (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  ema_message_id uuid references public.ema_messages(id) on delete cascade,
  ema_candidate_id uuid references public.ema_candidates(id) on delete cascade,
  ema_operation_id uuid references public.ema_operations(id) on delete cascade,
  step text not null,
  error_code text,
  error_message text not null,
  details jsonb not null default '{}'::jsonb,
  is_test boolean not null default false,
  test_run_id uuid,
  created_at timestamptz not null default now(),
  check (
    ema_message_id is not null or ema_candidate_id is not null or ema_operation_id is not null
  ),
  check (not is_test or test_run_id is not null)
);

create index ema_messages_thread_idx
  on public.ema_messages(workspace_id, gmail_thread_id);
create index ema_messages_status_received_idx
  on public.ema_messages(workspace_id, processing_status, received_at desc);
create index ema_messages_test_run_idx
  on public.ema_messages(test_run_id) where is_test;

create index ema_candidates_message_idx
  on public.ema_candidates(ema_message_id);
create index ema_candidates_parent_idx
  on public.ema_candidates(parent_candidate_id) where parent_candidate_id is not null;
create index ema_candidates_fingerprint_idx
  on public.ema_candidates(workspace_id, candidate_fingerprint);
create index ema_candidates_cash_task_idx
  on public.ema_candidates(cash_task_id) where cash_task_id is not null;
create index ema_candidates_test_run_idx
  on public.ema_candidates(test_run_id) where is_test;

create index ema_operations_message_idx
  on public.ema_operations(ema_message_id) where ema_message_id is not null;
create index ema_operations_candidate_idx
  on public.ema_operations(ema_candidate_id) where ema_candidate_id is not null;
create index ema_operations_status_idx
  on public.ema_operations(workspace_id, operation_status, updated_at);
create index ema_operations_test_run_idx
  on public.ema_operations(test_run_id) where is_test;

create index ema_errors_message_idx
  on public.ema_errors(ema_message_id) where ema_message_id is not null;
create index ema_errors_created_idx
  on public.ema_errors(workspace_id, created_at desc);
create index ema_errors_test_run_idx
  on public.ema_errors(test_run_id) where is_test;

create trigger ema_messages_set_updated_at
before update on public.ema_messages
for each row execute function public.update_updated_at_column();

create trigger ema_candidates_set_updated_at
before update on public.ema_candidates
for each row execute function public.update_updated_at_column();

create trigger ema_operations_set_updated_at
before update on public.ema_operations
for each row execute function public.update_updated_at_column();

alter table public.ema_messages enable row level security;
alter table public.ema_candidates enable row level security;
alter table public.ema_operations enable row level security;
alter table public.ema_errors enable row level security;

create policy "Workspace admins can view Ema messages"
on public.ema_messages for select to authenticated
using (
  public.has_role(auth.uid(), 'admin')
  and workspace_id in (
    select p.workspace_id from public.profiles p where p.user_id = auth.uid()
  )
);

create policy "Workspace admins can view Ema candidates"
on public.ema_candidates for select to authenticated
using (
  public.has_role(auth.uid(), 'admin')
  and workspace_id in (
    select p.workspace_id from public.profiles p where p.user_id = auth.uid()
  )
);

create policy "Workspace admins can view Ema operations"
on public.ema_operations for select to authenticated
using (
  public.has_role(auth.uid(), 'admin')
  and workspace_id in (
    select p.workspace_id from public.profiles p where p.user_id = auth.uid()
  )
);

create policy "Workspace admins can view Ema errors"
on public.ema_errors for select to authenticated
using (
  public.has_role(auth.uid(), 'admin')
  and workspace_id in (
    select p.workspace_id from public.profiles p where p.user_id = auth.uid()
  )
);

revoke all on public.ema_messages from anon, authenticated;
revoke all on public.ema_candidates from anon, authenticated;
revoke all on public.ema_operations from anon, authenticated;
revoke all on public.ema_errors from anon, authenticated;

grant select on public.ema_messages to authenticated;
grant select on public.ema_candidates to authenticated;
grant select on public.ema_operations to authenticated;
grant select on public.ema_errors to authenticated;

grant all on public.ema_messages to service_role;
grant all on public.ema_candidates to service_role;
grant all on public.ema_operations to service_role;
grant all on public.ema_errors to service_role;

comment on table public.ema_messages is
  'Gmail messages claimed and processed by Ema.';
comment on table public.ema_candidates is
  'Independent property or business candidates extracted from Ema messages.';
comment on table public.ema_operations is
  'Idempotent external effects planned or performed by Ema.';
comment on table public.ema_errors is
  'Append-only processing error history for Ema.';
;
