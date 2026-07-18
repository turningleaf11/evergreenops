-- TC deadline engine: business-day math, the buyer-EMD 24h clock, and a daily
-- job that pings the Activity inbox as deadlines approach or pass.
-- (pg_cron enabled in a prior migration.)

alter table public.crm_transactions
  add column if not exists assignment_signed_at date,
  add column if not exists buyer_emd_received_at date;

create table if not exists public.business_holidays (
  holiday date primary key,
  label text
);
insert into public.business_holidays (holiday, label) values
  ('2026-01-01','New Year''s Day'), ('2026-01-19','MLK Day'), ('2026-02-16','Presidents Day'),
  ('2026-05-25','Memorial Day'), ('2026-06-19','Juneteenth'), ('2026-07-03','Independence Day (obs)'),
  ('2026-09-07','Labor Day'), ('2026-10-12','Columbus Day'), ('2026-11-11','Veterans Day'),
  ('2026-11-26','Thanksgiving'), ('2026-12-25','Christmas'),
  ('2027-01-01','New Year''s Day'), ('2027-01-18','MLK Day'), ('2027-02-15','Presidents Day'),
  ('2027-05-31','Memorial Day'), ('2027-06-18','Juneteenth (obs)'), ('2027-07-05','Independence Day (obs)'),
  ('2027-09-06','Labor Day'), ('2027-10-11','Columbus Day'), ('2027-11-11','Veterans Day'),
  ('2027-11-25','Thanksgiving'), ('2027-12-24','Christmas (obs)')
on conflict (holiday) do nothing;

alter table public.business_holidays enable row level security;
create policy "Team reads holidays" on public.business_holidays for select to authenticated using (true);

create or replace function public.is_business_day(d date) returns boolean language sql stable as $$
  select extract(isodow from d) < 6 and not exists (select 1 from public.business_holidays h where h.holiday = d);
$$;
create or replace function public.next_business_day(d date) returns date language plpgsql stable as $$
declare x date := d;
begin
  while not public.is_business_day(x) loop x := x + 1; end loop;
  return x;
end $$;

create table if not exists public.deal_deadline_pings (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.crm_transactions(id) on delete cascade,
  deadline_key text not null,
  due_date date not null,
  bucket text not null,
  created_at timestamptz not null default now(),
  unique (transaction_id, deadline_key, due_date, bucket)
);
alter table public.deal_deadline_pings enable row level security;
create policy "Team reads deadline pings" on public.deal_deadline_pings for select to authenticated using (true);

create or replace function public.run_deadline_checks() returns int language plpgsql security definer as $$
declare
  r record; d record;
  v_days int; v_bucket text; v_sev text; v_needs boolean; v_title text;
  v_count int := 0; v_ins uuid;
begin
  for r in
    select t.id, t.emd_due_date, t.due_diligence_end, t.closing_date,
           t.assignment_signed_at, t.buyer_emd_received_at,
           coalesce(nullif(t.marketing_title,''), nullif(t.property_address,''), nullif(t.property_city,''), 'Deal') as label
    from public.crm_transactions t
    where t.stage is null or t.stage not in ('closed_won','lost_dead')
  loop
    for d in
      select * from (values
        ('emd_due',   'EMD (contract)', r.emd_due_date),
        ('dd_end',    'Due diligence',  r.due_diligence_end),
        ('closing',   'Closing',        r.closing_date),
        ('buyer_emd', 'Buyer EMD',
           case when r.assignment_signed_at is not null and r.buyer_emd_received_at is null
                then public.next_business_day(r.assignment_signed_at + 1) else null end)
      ) as x(key, label, due)
    loop
      continue when d.due is null;
      v_days := d.due - current_date;
      if v_days < 0 then v_bucket := 'overdue';
      elsif v_days = 0 then v_bucket := 'today';
      elsif v_days = 1 then v_bucket := 'tomorrow';
      elsif v_days <= 3 then v_bucket := 'soon';
      else continue;
      end if;

      v_ins := null;
      insert into public.deal_deadline_pings (transaction_id, deadline_key, due_date, bucket)
      values (r.id, d.key, d.due, v_bucket)
      on conflict (transaction_id, deadline_key, due_date, bucket) do nothing
      returning id into v_ins;
      continue when v_ins is null;

      v_sev := case when v_bucket = 'overdue' then 'error' when v_bucket in ('today','tomorrow') then 'warning' else 'info' end;
      v_needs := v_bucket in ('overdue','today','tomorrow');
      v_title := d.label || ' ' || case v_bucket
                   when 'overdue' then 'is overdue' when 'today' then 'is due today'
                   when 'tomorrow' then 'is due tomorrow' else 'is coming up' end
                 || ' — ' || r.label;

      insert into public.events (type, severity, title, source, entity_type, entity_id, entity_label, needs_action, metadata)
      values ('deadline', v_sev, v_title, 'opshq', 'deal', r.id, r.label, v_needs,
              jsonb_build_object('deadline', d.key, 'due_date', d.due, 'days', v_days));
      v_count := v_count + 1;
    end loop;
  end loop;
  return v_count;
end $$;

-- Run every weekday morning (13:00 UTC ~ 8-9am ET).
select cron.schedule('deal-deadline-checks', '0 13 * * 1-5', $$select public.run_deadline_checks()$$);
