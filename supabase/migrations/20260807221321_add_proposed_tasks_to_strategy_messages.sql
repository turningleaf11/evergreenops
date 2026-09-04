alter table public.ai_strategy_messages
  add column if not exists proposed_tasks jsonb,
  add column if not exists tasks_created boolean not null default false;;
