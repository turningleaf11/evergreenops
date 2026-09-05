-- Inbound media: a fetch queue, not a fetch.
--
-- The photo is the core loop for the personal brand — content-generate already
-- reads an image and writes to what it sees — but a WhatsApp message carries a
-- media REFERENCE, not the bytes. Getting the actual image needs a second
-- authenticated call to the provider, which must not happen inside the webhook:
-- providers time out webhooks, and a slow download would turn a delivered
-- message into a retried one.
--
-- So the webhook records references and returns. This queue is drained
-- separately, with leases and an attempt cap, so a provider outage degrades to
-- "the photo arrives late" rather than "the message was lost".

create table if not exists inbound_media (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id),
  message_id uuid not null references inbound_messages(id) on delete cascade,
  provider text not null check (provider in ('meta', 'twilio')),
  -- Meta: a media id resolved through the Graph API. Twilio: a full URL.
  -- Either way it comes from an external payload and is never fetched without
  -- the host check in the fetcher.
  media_ref text not null,
  mime_type text,
  status text not null default 'pending'
    check (status in ('pending', 'fetched', 'failed', 'skipped_unsupported', 'skipped_too_large')),
  storage_path text,
  bytes integer,
  attempts integer not null default 0,
  last_error text,
  leased_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (message_id, media_ref)
);

create index if not exists inbound_media_pending_idx
  on inbound_media (status, created_at) where status = 'pending';

-- Seeds carry the fetched image so the generator can actually see it. One image
-- per seed in v1: a drop is usually one photo, and picking between several is a
-- judgement the reviewer can make.
alter table content_seeds add column if not exists media_url text;

-- ---------------------------------------------------------------------------
-- Enqueue. Called by inbound_message_record once the message row exists.
-- ---------------------------------------------------------------------------
create or replace function inbound_media_enqueue(p_message_id uuid)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_message inbound_messages%rowtype;
  v_item jsonb;
  v_count integer := 0;
begin
  select * into v_message from inbound_messages where id = p_message_id;
  if not found then return 0; end if;

  for v_item in select * from jsonb_array_elements(coalesce(v_message.media, '[]'::jsonb)) loop
    insert into inbound_media (workspace_id, message_id, provider, media_ref, mime_type)
    values (
      v_message.workspace_id,
      p_message_id,
      coalesce(v_item->>'provider', 'meta'),
      v_item->>'media_id',
      v_item->>'mime_type'
    )
    on conflict (message_id, media_ref) do nothing;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- Claim work. Same lease pattern as the agent task queue: overlapping runs must
-- never fetch the same item twice, and a run that dies mid-download returns its
-- item to the queue rather than wedging it.
--
-- The attempt cap matters more than it looks. Without it a permanently broken
-- reference is retried forever, and the queue quietly becomes a way to make the
-- system call an external host on a loop.
-- ---------------------------------------------------------------------------
create or replace function inbound_media_claim_next(p_limit integer default 5, p_lease_seconds integer default 120)
returns table (id uuid, provider text, media_ref text, mime_type text, message_id uuid, workspace_id uuid)
language plpgsql
security definer
set search_path to 'public'
as $fn$
begin
  if p_limit is null or p_limit < 1 or p_limit > 25 then
    raise exception 'limit must be between 1 and 25, got %', p_limit;
  end if;

  return query
  update inbound_media m
     set leased_until = now() + make_interval(secs => p_lease_seconds),
         attempts = m.attempts + 1,
         updated_at = now()
   where m.id in (
     select c.id from inbound_media c
      where c.status = 'pending'
        and c.attempts < 3
        and (c.leased_until is null or c.leased_until < now())
      order by c.created_at
      for update skip locked
      limit p_limit
   )
  returning m.id, m.provider, m.media_ref, m.mime_type, m.message_id, m.workspace_id;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- Record the outcome, and attach the image to the seed the message created.
-- ---------------------------------------------------------------------------
create or replace function inbound_media_complete(
  p_id uuid,
  p_status text,
  p_storage_path text default null,
  p_bytes integer default null,
  p_public_url text default null,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_media inbound_media%rowtype;
  v_seed_ref uuid;
begin
  if p_status not in ('fetched', 'failed', 'skipped_unsupported', 'skipped_too_large') then
    raise exception 'invalid completion status %', p_status;
  end if;

  update inbound_media
     set status = p_status,
         storage_path = coalesce(p_storage_path, storage_path),
         bytes = coalesce(p_bytes, bytes),
         last_error = left(p_error, 500),
         leased_until = null,
         updated_at = now()
   where id = p_id
  returning * into v_media;

  if not found then raise exception 'media % not found', p_id; end if;

  -- Attach to the seed, but never overwrite one already attached: the first
  -- image of a batch is the one the reviewer saw when the seed appeared.
  if p_status = 'fetched' and p_public_url is not null then
    select routed_ref into v_seed_ref from inbound_messages where id = v_media.message_id;
    if v_seed_ref is not null then
      update content_seeds
         set media_url = p_public_url, updated_at = now()
       where id = v_seed_ref and media_url is null;
    end if;
  end if;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- Enqueue on record. Replaces the v1 function body's tail rather than making
-- the webhook responsible for remembering to call two things.
-- ---------------------------------------------------------------------------
create or replace function inbound_message_enqueue_media()
returns trigger
language plpgsql
as $fn$
begin
  if jsonb_array_length(coalesce(new.media, '[]'::jsonb)) > 0 and new.status = 'routed' then
    perform inbound_media_enqueue(new.id);
  end if;
  return new;
end;
$fn$;

drop trigger if exists inbound_message_media_enqueue on inbound_messages;
create trigger inbound_message_media_enqueue
  after insert on inbound_messages
  for each row execute function inbound_message_enqueue_media();

alter table inbound_media enable row level security;
drop policy if exists inbound_media_workspace on inbound_media;
create policy inbound_media_workspace on inbound_media
  for all using (workspace_id = public.get_user_workspace_id())
  with check (workspace_id = public.get_user_workspace_id());

do $revoke$
declare v_fn text; v_role text;
begin
  foreach v_fn in array array[
    'inbound_media_enqueue(uuid)',
    'inbound_media_claim_next(integer, integer)',
    'inbound_media_complete(uuid, text, text, integer, text, text)'
  ] loop
    execute format('revoke all on function %s from public', v_fn);
    foreach v_role in array array['anon', 'authenticated'] loop
      if exists (select 1 from pg_roles where rolname = v_role) then
        execute format('revoke all on function %s from %I', v_fn, v_role);
      end if;
    end loop;
  end loop;
end;
$revoke$;

-- ---------------------------------------------------------------------------
-- Storage bucket. PRIVATE: these are Autumn's photos before she has decided
-- whether any of them are going out. Access is by signed URL only.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'content-media',
  'content-media',
  false,
  16777216,
  array['image/jpeg','image/png','image/webp','image/gif','image/heic',
        'video/mp4','video/quicktime','video/3gpp','video/webm']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Workspace members can read what is theirs; the fetcher writes as the service
-- role, which bypasses these.
drop policy if exists content_media_read on storage.objects;
create policy content_media_read on storage.objects
  for select using (
    bucket_id = 'content-media'
    and (storage.foldername(name))[1] = public.get_user_workspace_id()::text
  );
