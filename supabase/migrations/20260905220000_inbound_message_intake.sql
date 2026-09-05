-- Generic inbound message intake.
--
-- Autumn already uses WhatsApp message-to-self as a dump for things worth
-- keeping. That habit is the highest-value input to the content engine — a
-- photo of a meal or the cat is captured in the moment or not at all — so the
-- channel meets the habit rather than asking her to learn a new one.
--
-- BUILT GENERIC ON PURPOSE. Autumn separately wants one place to dump
-- everything, with a triage agent that routes each item to the right agent.
-- That is a different build, but it is the same channel and the same input, so
-- this is a channel-agnostic inbound table plus a routing step. v1 registers
-- exactly one route (content seeds). The triage agent later adds routes without
-- replacing any of this. Building it Marquetta-shaped would mean tearing it out
-- and would leave two competing dump channels in the meantime, which defeats
-- the point of having one.

-- ---------------------------------------------------------------------------
-- Who is allowed to send. This is the whole authentication story for an
-- endpoint that is otherwise public.
--
-- A webhook that creates content seeds from any inbound message is an injection
-- vector: anyone who learns the number could plant material that later reaches
-- a review queue wearing Autumn's voice. Signature verification proves the
-- message came from the provider; it says nothing about who sent it. So senders
-- are allowlisted, and an unrecognised sender is recorded and ignored rather
-- than routed.
-- ---------------------------------------------------------------------------
create table if not exists inbound_senders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id),
  channel text not null check (channel in ('whatsapp', 'sms', 'email')),
  -- E.164 for phone channels. Normalised on write by the receiver.
  identifier text not null,
  user_id uuid references auth.users(id) on delete set null,
  label text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (channel, identifier)
);

-- ---------------------------------------------------------------------------
-- Every inbound message, routed or not.
--
-- Unrouted messages are kept deliberately: "I sent it and nothing happened" is
-- otherwise unanswerable, and a message from an unknown sender is worth seeing
-- once even though it must never be acted on.
-- ---------------------------------------------------------------------------
create table if not exists inbound_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id),
  channel text not null,
  -- Provider's own message id. The idempotency key: providers retry webhooks,
  -- and a retried photo must not become a second seed.
  external_id text not null,
  from_identifier text not null,
  sender_id uuid references inbound_senders(id) on delete set null,
  body text,
  -- [{media_id, mime_type, provider, downloaded_url}] — see the note on media
  -- below. References first; the bytes are fetched separately.
  media jsonb not null default '[]'::jsonb,
  received_at timestamptz not null default now(),
  status text not null default 'new'
    check (status in ('new', 'routed', 'ignored_unknown_sender', 'ignored_disabled_sender', 'ignored_empty', 'failed')),
  route text,
  routed_ref uuid,
  routed_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  unique (channel, external_id)
);

create index if not exists inbound_messages_status_idx on inbound_messages (status, received_at desc);
create index if not exists inbound_messages_sender_idx on inbound_messages (from_identifier, received_at desc);

-- ---------------------------------------------------------------------------
-- Record and route, in one transaction.
--
-- Returns the disposition rather than raising, because the caller is a webhook:
-- a provider that gets a 500 retries, and retrying an unknown sender forever
-- helps nobody. The endpoint should answer 200 to anything it has successfully
-- recorded, whatever it then decided to do with it.
-- ---------------------------------------------------------------------------
create or replace function inbound_message_record(
  p_channel text,
  p_external_id text,
  p_from_identifier text,
  p_body text default null,
  p_media jsonb default '[]'::jsonb
)
returns table (message_id uuid, status text, route text, routed_ref uuid)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_sender inbound_senders%rowtype;
  v_existing inbound_messages%rowtype;
  v_status text;
  v_route text := null;
  v_ref uuid := null;
  v_message_id uuid;
  v_brand_id uuid;
begin
  -- Idempotency first: a provider retry returns the original disposition
  -- without creating anything.
  select * into v_existing from inbound_messages
   where channel = p_channel and external_id = p_external_id;
  if found then
    return query select v_existing.id, v_existing.status, v_existing.route, v_existing.routed_ref;
    return;
  end if;

  -- Fetched without the enabled filter so a disabled sender reports as
  -- disabled rather than unknown. "I turned it off and it says unknown number"
  -- is an afternoon of confusion for one word of accuracy here.
  select * into v_sender from inbound_senders
   where channel = p_channel and identifier = p_from_identifier;

  if not found then
    v_status := 'ignored_unknown_sender';
  elsif not v_sender.enabled then
    v_status := 'ignored_disabled_sender';
  elsif coalesce(btrim(p_body), '') = '' and jsonb_array_length(coalesce(p_media, '[]'::jsonb)) = 0 then
    v_status := 'ignored_empty';
  else
    v_status := 'routed';
    -- v1 has exactly one route. The triage agent replaces this branch with a
    -- real classifier; everything around it stays.
    v_route := 'content';
  end if;

  insert into inbound_messages (workspace_id, channel, external_id, from_identifier, sender_id, body, media, status, route)
  values (v_sender.workspace_id, p_channel, p_external_id, p_from_identifier, v_sender.id, p_body, coalesce(p_media, '[]'::jsonb), v_status, v_route)
  returning id into v_message_id;

  if v_route = 'content' then
    -- Default to the first brand in the workspace. A drop is almost always
    -- personal-brand material, and a human re-targets it in the review queue if
    -- not — better than making Autumn specify a brand in a message she is
    -- sending one-handed.
    select id into v_brand_id from content_brands
     where workspace_id = v_sender.workspace_id
     order by sort_order nulls last, created_at limit 1;

    insert into content_seeds (workspace_id, user_id, brand_id, source, source_ref, raw, score)
    values (
      v_sender.workspace_id,
      v_sender.user_id,
      v_brand_id,
      'manual',
      p_channel || ':' || p_external_id,
      coalesce(nullif(btrim(p_body), ''), '[media only]'),
      -- A human took the trouble to send this. It outranks anything the capture
      -- lane found on its own.
      80
    )
    on conflict (workspace_id, source, source_ref) do update set updated_at = now()
    returning id into v_ref;

    update inbound_messages set routed_ref = v_ref, routed_at = now() where id = v_message_id;
  end if;

  return query select v_message_id, v_status, v_route, v_ref;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- RLS. Workspace-scoped, consistent with the content tables. The receiver runs
-- as the service role.
-- ---------------------------------------------------------------------------
alter table inbound_senders enable row level security;
alter table inbound_messages enable row level security;

drop policy if exists inbound_senders_workspace on inbound_senders;
create policy inbound_senders_workspace on inbound_senders
  for all using (workspace_id = public.get_user_workspace_id())
  with check (workspace_id = public.get_user_workspace_id());

drop policy if exists inbound_messages_workspace on inbound_messages;
create policy inbound_messages_workspace on inbound_messages
  for all using (workspace_id = public.get_user_workspace_id())
  with check (workspace_id = public.get_user_workspace_id());

do $revoke$
declare v_role text;
begin
  execute 'revoke all on function inbound_message_record(text, text, text, text, jsonb) from public';
  foreach v_role in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = v_role) then
      execute format('revoke all on function inbound_message_record(text, text, text, text, jsonb) from %I', v_role);
    end if;
  end loop;
end;
$revoke$;

-- NOTE ON MEDIA. This records media references, not bytes. WhatsApp media needs
-- a second authenticated call to the provider to download, and storing it needs
-- a bucket decision. The photo is the core loop for the personal brand, so that
-- fetch is the next piece of work — but a table that pretends to hold images it
-- does not hold would be worse than one that is honest about holding pointers.
