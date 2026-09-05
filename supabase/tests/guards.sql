\set ON_ERROR_STOP 0
\pset pager off
create role app_user nologin;
grant usage on schema public, auth to app_user;
grant all on all tables in schema public to app_user;
grant execute on all functions in schema public, auth to app_user;

\echo '--- 1. dedupe: expect 3 brands remaining ---'
select count(*) as brands_remaining from content_brands;

\echo '--- 2. re-triplication blocked by unique index (expect ERROR) ---'
insert into content_brands (user_id, workspace_id, name)
values ('aaaaaaaa-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','Autumn Alexander');

\echo '--- 3. cross-user visibility under workspace RLS ---'
set local role app_user;
set local "test.uid" = 'aaaaaaaa-0000-0000-0000-000000000003';
select count(*) as brands_visible_to_user3 from content_brands;
reset role;

\echo '--- 4. content_library accepts review, rejects garbage ---'
insert into content_library (workspace_id, status, content) values ('11111111-1111-1111-1111-111111111111','review','x');
select count(*) as review_rows from content_library where status='review';
insert into content_library (workspace_id, status, content) values ('11111111-1111-1111-1111-111111111111','published','x');

\echo '--- 5. approved voice exemplar is immutable (expect ERROR on text edit) ---'
insert into content_voice_exemplars (workspace_id, brand_id, text, status)
select '11111111-1111-1111-1111-111111111111', id, 'Ok, I''ll play', 'approved' from content_brands limit 1;
update content_voice_exemplars set text = 'REWRITTEN BY AGENT' where status='approved';

\echo '--- 5b. but demotion is still allowed (expect UPDATE 1) ---'
update content_voice_exemplars set status='candidate' where status='approved';

\echo '--- 6. seed idempotency: second identical capture rejected (expect ERROR) ---'
insert into content_seeds (workspace_id, source, source_ref, raw)
values ('11111111-1111-1111-1111-111111111111','deal','deal-123','Closed 1109 Riviera');
insert into content_seeds (workspace_id, source, source_ref, raw)
values ('11111111-1111-1111-1111-111111111111','deal','deal-123','Closed 1109 Riviera');

\echo '--- 7. schedule cannot be created in a released state by CHECK bypass (expect ERROR) ---'
insert into content_schedule (workspace_id, content_id, platform, status)
select '11111111-1111-1111-1111-111111111111', id, 'instagram', 'live' from content_library limit 1;
