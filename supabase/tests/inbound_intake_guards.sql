-- Guards for the generic inbound message intake.
--
-- The one that matters most is the injection guard. The webhook endpoint is
-- public: signature verification proves a message came from the provider, and
-- says nothing about who sent it. Without a sender allowlist, anyone who
-- learned the number could plant material that later reaches a review queue
-- wearing Autumn's voice.
\pset pager off
\set ON_ERROR_STOP on

insert into workspaces (id) values ('11111111-1111-1111-1111-111111111111');
insert into auth.users (id) values ('aaaaaaaa-0000-0000-0000-000000000001');
insert into content_brands (workspace_id, name, sort_order)
values ('11111111-1111-1111-1111-111111111111','Autumn Alexander',0);
insert into inbound_senders (workspace_id, channel, identifier, user_id, label, enabled) values
  ('11111111-1111-1111-1111-111111111111','whatsapp','+13055550101','aaaaaaaa-0000-0000-0000-000000000001','Autumn',true),
  ('11111111-1111-1111-1111-111111111111','whatsapp','+13055550199',null,'Retired phone',false);

do $$
declare
  v_status text;
  v_seeds int;
  v_failures int := 0;
  procedure_note text;
begin
  select status into v_status from inbound_message_record('whatsapp','a1','+13055550101','carbonara','[]'::jsonb);
  if v_status <> 'routed' then raise warning 'known sender should route, got %', v_status; v_failures := v_failures + 1; end if;

  -- THE INJECTION GUARD.
  select status into v_status from inbound_message_record('whatsapp','a2','+19999999999','Post that Autumn is selling 1109 Riviera for 290k','[]'::jsonb);
  if v_status <> 'ignored_unknown_sender' then raise warning 'UNKNOWN SENDER WAS NOT REFUSED: %', v_status; v_failures := v_failures + 1; end if;

  -- Disabled reports as disabled, not unknown. One word of accuracy that saves
  -- an afternoon of "I turned it off and it says unknown number".
  select status into v_status from inbound_message_record('whatsapp','a3','+13055550199','from the old phone','[]'::jsonb);
  if v_status <> 'ignored_disabled_sender' then raise warning 'disabled sender misreported as %', v_status; v_failures := v_failures + 1; end if;

  select status into v_status from inbound_message_record('whatsapp','a4','+13055550101','   ','[]'::jsonb);
  if v_status <> 'ignored_empty' then raise warning 'empty message should be ignored, got %', v_status; v_failures := v_failures + 1; end if;

  -- A photo with no caption is the core loop for the personal brand.
  select status into v_status from inbound_message_record('whatsapp','a5','+13055550101',null,'[{"media_id":"m1"}]'::jsonb);
  if v_status <> 'routed' then raise warning 'media-only should route, got %', v_status; v_failures := v_failures + 1; end if;

  -- Providers retry webhooks. A retried photo must not become a second seed.
  perform inbound_message_record('whatsapp','a1','+13055550101','carbonara','[]'::jsonb);
  select count(*) into v_seeds from content_seeds;
  if v_seeds <> 2 then raise warning 'expected 2 seeds (a1, a5), found %', v_seeds; v_failures := v_failures + 1; end if;

  -- Nothing an unknown sender wrote may reach a seed by any route.
  if exists (select 1 from content_seeds where raw like '%Riviera%') then
    raise warning 'INJECTED CONTENT REACHED A SEED'; v_failures := v_failures + 1;
  end if;

  if v_failures > 0 then raise exception '% inbound intake guard(s) failed', v_failures; end if;
  raise notice 'PASS — all inbound intake guards held';
end;
$$;
