-- Team Hub resources: curated shelves, addressed by role.
--
-- Two things this gets right that the previous Team Hub did not:
--
-- 1. A resource is not always a wiki page. `kind` covers doc / file / link /
--    video, so a PDF template or a Loom walkthrough is a first-class item
--    rather than something with nowhere to live.
--
-- 2. Role and track are different axes and were previously conflated —
--    orbit_types.ts lists dts, dta, deal_scout, underwriting and closer as if
--    they were the same kind of thing. They are not. DTS/DTA/DTB/DTW are
--    *doors*: which channel a Jr. Acquisitions person works. Closer,
--    Underwriter, Dispo, TC and Ops are *roles*. A Jr. Acq on DTS and a Jr.
--    Acq on DTA hold the same job and need almost all of the same material;
--    only the door-specific pieces differ.
--
-- So: shelves are addressed to a role (or to everyone), and individual items
-- may narrow further to a track. Structure is curated by hand in OpsHQ, never
-- derived from tags — deriving it was what made the old page unreorganizable
-- without re-tagging every document.

/* ── org vocabulary ─────────────────────────────────────────────────────── */

-- Roles are data rather than an enum: this list has already changed once, and
-- changing it should not need a migration and a redeploy.
create table if not exists public.team_roles (
  key text primary key,
  label text not null,
  department_id uuid references public.departments(id) on delete set null,
  -- Only Jr. Acq is split by door today. The flag keeps the OpsHQ editor from
  -- offering a track picker for roles where it would be meaningless.
  has_tracks boolean not null default false,
  sort_order integer not null default 0
);

insert into public.team_roles (key, label, department_id, has_tracks, sort_order)
select v.key, v.label, d.id, v.has_tracks, v.ord
from (values
  ('jr_acq',      'Jr. Acquisitions',      'Acq',   true,  0),
  ('closer',      'Closer',                'Acq',   false, 1),
  ('underwriter', 'Underwriter',           'Acq',   false, 2),
  ('dispo',       'Dispositions',          'Dispo', false, 3),
  ('tc',          'Transaction Coordinator','Ops',  false, 4),
  ('ops',         'Operations',            'Ops',   false, 5)
) as v(key, label, dept_name, has_tracks, ord)
left join public.departments d on d.name = v.dept_name
on conflict (key) do nothing;

-- Which door a Jr. Acq works. Kept separate from role on purpose.
create table if not exists public.team_tracks (
  key text primary key,
  label text not null,
  sort_order integer not null default 0
);

insert into public.team_tracks (key, label, sort_order)
values ('dts', 'DTS — Direct to Seller', 0),
       ('dta', 'DTA — Direct to Agent', 1),
       ('dtb', 'DTB — Direct to Broker', 2),
       ('dtw', 'DTW — Direct to Wholesaler', 3)
on conflict (key) do nothing;

-- A person's job. profiles rather than orbit_members because TC and Ops are
-- not in the Orbit program but still use the hub; orbit_members.track stays
-- the source of truth for the door.
alter table public.profiles
  add column if not exists role_key text references public.team_roles(key) on delete set null;

/* ── the shelves ────────────────────────────────────────────────────────── */

create table if not exists public.team_hub_sections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid,
  title text not null,
  description text,
  icon text,
  -- null = everyone sees this shelf, whatever their role.
  role_key text references public.team_roles(key) on delete cascade,
  sort_order integer not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.team_hub_resources (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid,
  section_id uuid references public.team_hub_sections(id) on delete cascade,
  title text not null,
  description text,
  kind text not null check (kind in ('doc', 'file', 'link', 'video')),
  -- kind='doc' points at the wiki rather than copying it: documents stays the
  -- authoring surface, and an edit in OpsHQ is live here with no sync step.
  document_id uuid references public.documents(id) on delete cascade,
  url text,                                     -- link/video, or the public URL for a file
  storage_path text,                            -- file, retained so deletes can clean up storage
  file_name text,
  file_size bigint,
  mime_type text,
  icon text,
  -- Empty = everyone on the shelf's role. Otherwise the doors this applies to,
  -- which is how one Jr. Acq shelf serves all four channels.
  tracks text[] not null default '{}',
  sort_order integer not null default 0,
  published boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists team_hub_resources_section_idx
  on public.team_hub_resources (section_id, sort_order);

alter table public.team_roles enable row level security;
alter table public.team_tracks enable row level security;
alter table public.team_hub_sections enable row level security;
alter table public.team_hub_resources enable row level security;

-- Managers are admins plus anyone already granted orbit_manage — the same gate
-- DepartmentPage uses for the roster, so there is no new permission to hand out.
create or replace function public.can_manage_team_hub()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select has_role(auth.uid(), 'admin'::app_role)
      or exists (
        select 1 from public.page_grants
        where user_id = auth.uid() and page_key = 'orbit_manage'
      );
$$;

create policy "team roles readable" on public.team_roles
  for select to authenticated using (true);
create policy "team roles managed" on public.team_roles
  for all to authenticated
  using (public.can_manage_team_hub()) with check (public.can_manage_team_hub());

create policy "team tracks readable" on public.team_tracks
  for select to authenticated using (true);
create policy "team tracks managed" on public.team_tracks
  for all to authenticated
  using (public.can_manage_team_hub()) with check (public.can_manage_team_hub());

create policy "team hub sections readable" on public.team_hub_sections
  for select to authenticated using (published or public.can_manage_team_hub());
create policy "team hub sections managed" on public.team_hub_sections
  for all to authenticated
  using (public.can_manage_team_hub()) with check (public.can_manage_team_hub());

create policy "team hub resources readable" on public.team_hub_resources
  for select to authenticated using (published or public.can_manage_team_hub());
create policy "team hub resources managed" on public.team_hub_resources
  for all to authenticated
  using (public.can_manage_team_hub()) with check (public.can_manage_team_hub());

/* ── seed ──────────────────────────────────────────────────────────────────
   Populated from the documents already tagged as curriculum, so the hub opens
   with content rather than an empty state someone has to fill before it is
   worth visiting.

   Note how the doors collapse: Cold Call Script, Warm Lead Script and the DTA
   script all sit on the one Jr. Acq "On a call" shelf, each narrowed to its
   own track. Same shelf, same role, different door.

   Untagged internal material (fundraising notes, contractor onboarding, loan
   assumption memos) is deliberately left out — documents is shared with
   OpsHQ, and "shared table" must not mean "everything is field-team reading".
   ────────────────────────────────────────────────────────────────────────── */

insert into public.team_hub_sections (title, description, icon, role_key, sort_order, workspace_id)
select v.title, v.description, v.icon, v.role_key, v.ord,
       (select workspace_id from public.documents where workspace_id is not null limit 1)
from (values
  ('Start here',          'New to the team — read these first.',                  '🌱', null,           0),
  ('On a call',           'What to say, and what to say when they push back.',    '📞', 'jr_acq',       1),
  ('Working your leads',  'Keeping the pipeline clean and moving.',               '📇', 'jr_acq',       2),
  ('Closing',             'Second call through signed agreement.',                '🤝', 'closer',       3),
  ('Underwriting',        'What you need to run the numbers.',                    '📐', 'underwriter',  4),
  ('Creative & distressed','When it is not a straight cash purchase.',            '🏦', 'closer',       5),
  ('Moving the deal',     'Getting it in front of buyers.',                       '📣', 'dispo',        6)
) as v(title, description, icon, role_key, ord)
where not exists (select 1 from public.team_hub_sections s where s.title = v.title);

-- distinct on (d.id) so a document matching two patterns lands on one shelf
-- only — the row-level NOT EXISTS below cannot dedupe within a single statement.
insert into public.team_hub_resources
  (section_id, document_id, title, kind, tracks, sort_order, workspace_id, icon)
select distinct on (d.id)
       s.id, d.id, d.title, 'doc', seed.tracks, seed.ord, d.workspace_id, '📄'
from (values
  ('Start here',           '%Our Values%',                        '{}'::text[],       0),
  ('Start here',           '%New Hire Training Checklist%',       '{}'::text[],       1),
  ('On a call',            'Cold Call Script',                    '{dts}'::text[],    0),
  ('On a call',            '%Cold Call Script - Seller Lead%',    '{dts}'::text[],    1),
  ('On a call',            '%Warm Lead Script%',                  '{dts}'::text[],    2),
  ('On a call',            '%DTS Call Scripts%',                  '{dts}'::text[],    3),
  ('On a call',            '%DTA Script - On Market Deal%',       '{dta}'::text[],    4),
  ('On a call',            'Agent Response Guide',                '{dta}'::text[],    5),
  ('On a call',            'Gathering Info from Brokers',         '{dtb}'::text[],    6),
  ('On a call',            'Objection Handling Playbook',         '{}'::text[],       7),
  ('On a call',            'Outbound Seller Lead Calling Guide',  '{dts}'::text[],    8),
  ('On a call',            '%Inbound Seller Lead Calling Guide%', '{dts}'::text[],    9),
  ('Working your leads',   '%GHL — How to Work Your Leads%',      '{dts}'::text[],    0),
  ('Working your leads',   '%DTA — How To Work In GHL%',          '{dta}'::text[],    1),
  ('Working your leads',   'Data Hygiene & CRM Standards',        '{}'::text[],       2),
  ('Working your leads',   '%Lead Lists Master SOP%',             '{}'::text[],       3),
  ('Working your leads',   'Skip Trace in Deal Machine',          '{}'::text[],       4),
  ('Working your leads',   'Broker List Building',                '{dtb}'::text[],    5),
  ('Closing',              '%Closer Script%',                     '{}'::text[],       0),
  ('Closing',              'Closer Training Guide',               '{}'::text[],       1),
  ('Closing',              'Offer & Negotiation Framework',       '{}'::text[],       2),
  ('Underwriting',         'SOP | Info Needed to Run DSCR',       '{}'::text[],       0),
  ('Creative & distressed','%Foreclosure%',                       '{}'::text[],       0),
  ('Creative & distressed','%Loan Modification%',                 '{}'::text[],       1),
  ('Moving the deal',      'Talking to Buyers Script',            '{}'::text[],       0),
  ('Moving the deal',      'LinkedIn Outreach',                   '{}'::text[],       1)
) as seed(section_title, pattern, tracks, ord)
join public.team_hub_sections s on s.title = seed.section_title
join public.documents d on d.title like seed.pattern
where not exists (
  select 1 from public.team_hub_resources r where r.document_id = d.id
)
order by d.id, s.sort_order, seed.ord;
