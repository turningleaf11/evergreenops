alter table public.ema_candidates
  add column if not exists buy_box_fit_result text not null default 'not_checked',
  add column if not exists buy_box_fit_details jsonb not null default '{}'::jsonb,
  add column if not exists buy_box_fit_checked_at timestamptz;

alter table public.ema_candidates
  drop constraint if exists ema_candidates_buy_box_fit_result_check;

alter table public.ema_candidates
  add constraint ema_candidates_buy_box_fit_result_check
  check (buy_box_fit_result = any (array['not_checked'::text,'fit'::text,'not_fit'::text,'needs_info'::text]));

create index if not exists ema_candidates_buy_box_fit_idx
  on public.ema_candidates (workspace_id, buy_box_fit_result, buy_box_fit_checked_at desc);;
