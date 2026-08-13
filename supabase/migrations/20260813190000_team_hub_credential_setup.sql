-- Team Hub accounts are provisioned by an admin with a temp password (no email
-- round trip). must_set_credential flags that the temp password is still live
-- and the user needs to pick their own password or PIN before using the app.
alter table public.profiles
  add column if not exists must_set_credential boolean not null default false;

-- PIN login is a second credential type layered on top of Supabase Auth, not
-- a replacement for it — team_hub_pin_login mints a real session by redeeming
-- a server-generated magiclink token after the PIN checks out. Rate-limited
-- via failed_attempts/locked_until since 4 digits is only 10,000 combinations.
create table if not exists public.team_hub_pins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  pin_hash text not null,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.team_hub_pins enable row level security;
-- No policies: this table is written and read exclusively by service-role
-- edge functions (team-hub-set-credential, team-hub-pin-login). Deny-all to
-- anon/authenticated is intentional, not an oversight.
