-- Guards for the inbound media fetch queue.
--
-- The queue exists because the download cannot happen inside the webhook:
-- providers time out webhooks, and a slow fetch would turn a delivered message
-- into a retried one. What matters here is that the queue behaves under the
-- conditions that actually occur — overlapping drains, expired leases,
-- references the provider has already expired, and media from senders who were
-- never allowed to send anything.
\pset pager off
\set ON_ERROR_STOP on

insert into workspaces (id) values ('11111111-1111-1111-1111-111111111111');
insert into auth.users (id) values ('aaaaaaaa-0000-0000-0000-000000000001');
insert into content_brands (workspace_id, name, sort_order)
values ('11111111-1111-1111-1111-111111111111','Autumn Alexander',0);
insert into inbound_senders (workspace_id, channel, identifier, user_id, label)
values ('11111111-1111-1111-1111-111111111111','whatsapp','+13055550101','aaaaaaaa-0000-0000-0000-000000000001','Autumn');

do $$
declare
  v_status text;
  v_count int;
  v_url text;
  v_media_id uuid;
  v_failures int := 0;
begin
  -- A photo drop queues its media automatically. No caller has to remember.
  select status into v_status from inbound_message_record(
    'whatsapp','p1','+13055550101','carbonara',
    '[{"media_id":"mid-1","mime_type":"image/jpeg","provider":"meta"}]'::jsonb);
  if v_status <> 'routed' then raise warning 'photo drop did not route: %', v_status; v_failures := v_failures + 1; end if;

  select count(*) into v_count from inbound_media where media_ref = 'mid-1';
  if v_count <> 1 then raise warning 'media was not enqueued, found %', v_count; v_failures := v_failures + 1; end if;

  -- Media from a sender who is not allowed to send must never enter the queue.
  -- Otherwise the allowlist stops content but still makes the server fetch
  -- whatever a stranger points it at.
  perform inbound_message_record('whatsapp','p2','+19999999999','evil',
    '[{"media_id":"mid-evil","provider":"meta"}]'::jsonb);
  if exists (select 1 from inbound_media where media_ref = 'mid-evil') then
    raise warning 'UNKNOWN SENDER MEDIA WAS QUEUED FOR FETCH'; v_failures := v_failures + 1;
  end if;

  -- Overlapping drains must not fetch the same item twice: two downloads means
  -- two uploads and a duplicated image.
  select count(*) into v_count from inbound_media_claim_next(5, 120);
  if v_count <> 1 then raise warning 'first claim returned %', v_count; v_failures := v_failures + 1; end if;
  select count(*) into v_count from inbound_media_claim_next(5, 120);
  if v_count <> 0 then raise warning 'a leased item was claimed twice'; v_failures := v_failures + 1; end if;

  -- Completing attaches the image to the seed the message created.
  select id into v_media_id from inbound_media where media_ref = 'mid-1';
  perform inbound_media_complete(v_media_id, 'fetched', 'ws/2026-09-05/x.jpg', 48210, 'https://signed.example/x.jpg');
  select media_url into v_url from content_seeds where source_ref = 'whatsapp:p1';
  if v_url is distinct from 'https://signed.example/x.jpg' then
    raise warning 'seed did not receive the image, got %', coalesce(v_url,'NULL'); v_failures := v_failures + 1;
  end if;

  -- The first image of a batch is the one the reviewer saw. A later arrival
  -- must not silently swap it.
  perform inbound_media_complete(v_media_id, 'fetched', 'ws/2026-09-05/y.jpg', 1, 'https://signed.example/SECOND.jpg');
  select media_url into v_url from content_seeds where source_ref = 'whatsapp:p1';
  if v_url <> 'https://signed.example/x.jpg' then
    raise warning 'a later image overwrote the first'; v_failures := v_failures + 1;
  end if;

  -- WhatsApp media expires. Without an attempt cap a dead reference becomes a
  -- loop that calls an external host forever.
  insert into inbound_media (workspace_id, message_id, provider, media_ref, attempts, status)
  select '11111111-1111-1111-1111-111111111111', id, 'meta', 'dead-ref', 3, 'pending'
    from inbound_messages where external_id = 'p1';
  select count(*) into v_count from inbound_media_claim_next(5, 120);
  if v_count <> 0 then raise warning 'an item past the attempt cap was claimed'; v_failures := v_failures + 1; end if;

  -- A worker that dies mid-download must not wedge the item.
  update inbound_media set status='pending', attempts=0, leased_until=now() - interval '1 hour' where media_ref='mid-1';
  select count(*) into v_count from inbound_media_claim_next(5, 120);
  if v_count <> 1 then raise warning 'an expired lease was not reclaimed'; v_failures := v_failures + 1; end if;

  -- The bucket holds photos taken before Autumn decided anything is going out.
  if (select public from storage.buckets where id = 'content-media') is not false then
    raise warning 'content-media bucket is PUBLIC'; v_failures := v_failures + 1;
  end if;

  if v_failures > 0 then raise exception '% inbound media guard(s) failed', v_failures; end if;
  raise notice 'PASS — all inbound media guards held';
end;
$$;
