-- Templates: reusable email/SMS copy for dispo outreach.
create table if not exists public.dispo_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  channel text not null check (channel in ('email','sms')),
  subject text,
  body text not null,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.dispo_templates enable row level security;
create policy "Team can view templates"   on public.dispo_templates for select to authenticated using (true);
create policy "Team can insert templates" on public.dispo_templates for insert to authenticated with check (true);
create policy "Team can update templates" on public.dispo_templates for update to authenticated using (true);
create policy "Team can delete templates" on public.dispo_templates for delete to authenticated using (true);

-- Campaigns can reference the template they came from and carry a display name.
alter table public.dispo_campaigns add column if not exists template_id uuid references public.dispo_templates(id) on delete set null;
alter table public.dispo_campaigns add column if not exists name text;

-- Response attribution: delivery status stays in `status`; engagement lives here.
alter table public.dispo_campaign_recipients add column if not exists responded_at timestamptz;;
