insert into workspaces (id) values ('11111111-1111-1111-1111-111111111111');
insert into auth.users (id) values
  ('aaaaaaaa-0000-0000-0000-000000000001'),
  ('aaaaaaaa-0000-0000-0000-000000000002'),
  ('aaaaaaaa-0000-0000-0000-000000000003');
insert into profiles (user_id, workspace_id)
  select id, '11111111-1111-1111-1111-111111111111' from auth.users;
-- reproduce the real triplication: 3 users x 3 brands, one workspace
insert into content_brands (user_id, workspace_id, name, created_at)
select u.id, '11111111-1111-1111-1111-111111111111', b.name,
       now() - (row_number() over ()) * interval '1 day'
from auth.users u cross join (values ('Autumn Alexander'),('Evergreen Home Group'),('Evergreen RE Ventures')) b(name);
