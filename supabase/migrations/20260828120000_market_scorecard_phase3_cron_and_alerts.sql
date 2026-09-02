-- Phase 3: monthly automatic re-scoring + decision-change alerts landing in
-- the task queue, not just the events feed.
--
-- The cron job calls the market-research edge function via pg_net, using the
-- project's anon key (the same public, browser-embeddable key already
-- shipped in src/integrations/supabase/client.ts -- safe to commit). The
-- edge function authenticates its own Postgres writes with its own
-- SUPABASE_SERVICE_ROLE_KEY env var; the anon key here only has to satisfy
-- the function gateway's verify_jwt check to let the call through.

create or replace function public.run_monthly_market_rescore()
returns int language plpgsql as $$
declare
  r record;
  v_count int := 0;
begin
  for r in select id, name, location, strategy, criteria from public.markets loop
    perform net.http_post(
      url := 'https://dsxrekabnwvarnroanny.supabase.co/functions/v1/market-research',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRzeHJla2Fibnd2YXJucm9hbm55Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwODY0NTIsImV4cCI6MjA5MzY2MjQ1Mn0.7XnSOz8luboLUp5_aMfaEVhoYRrzeSncCJhHEd9aGcs',
        'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRzeHJla2Fibnd2YXJucm9hbm55Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwODY0NTIsImV4cCI6MjA5MzY2MjQ1Mn0.7XnSOz8luboLUp5_aMfaEVhoYRrzeSncCJhHEd9aGcs'
      ),
      body := jsonb_build_object(
        'marketId', r.id,
        'market', coalesce(nullif(r.location, ''), r.name),
        'strategy', coalesce(nullif(r.strategy, ''), 'buy_and_hold'),
        'customCriteria', r.criteria
      ),
      timeout_milliseconds := 45000
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- Anchored to the 1st of the month, 13:00 UTC (~8-9am ET), matching the
-- existing deal-deadline-checks cron's time-of-day convention.
select cron.schedule('monthly-market-rescore', '0 13 1 * *', $$select public.run_monthly_market_rescore()$$);

-- Decision-change alerts now also land in agent_tasks (the shared task
-- queue), not just the events feed -- a flip is something to actually look
-- at, not just something logged.
create or replace function public.log_market_decision_change()
returns trigger language plpgsql as $$
begin
  if old.decision is distinct from new.decision and old.decision is not null then
    insert into public.events (
      type, severity, title, source, entity_type, entity_id, entity_label, needs_action, metadata
    ) values (
      'market_decision_change',
      case when new.decision = 'no_go' then 'warning' else 'info' end,
      new.name || ' moved from ' || upper(old.decision) || ' to ' || upper(new.decision),
      'opshq',
      'market',
      new.id,
      new.name,
      true,
      jsonb_build_object('previous_decision', old.decision, 'new_decision', new.decision)
    );

    insert into public.agent_tasks (
      title, description, assigned_to, status, priority, type, context, workspace_id
    ) values (
      new.name || ' moved from ' || upper(old.decision) || ' to ' || upper(new.decision),
      coalesce(nullif(new.decision_why, ''), 'Market scorecard decision changed on a re-score.'),
      'claude',
      'todo',
      case when new.decision = 'no_go' then 'high' else 'medium' end,
      'general',
      jsonb_build_object('market_id', new.id, 'previous_decision', old.decision, 'new_decision', new.decision),
      new.workspace_id
    );
  end if;
  return new;
end;
$$;
