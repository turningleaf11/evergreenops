-- Marquetta content engine — schema foundation.
--
-- Step 1 of the build order in docs/marquetta-content-engine.md. These tables
-- back the marketing agent's five lanes (capture, research, draft, clip,
-- schedule) and extend the existing Content Studio rather than replacing it.
--
-- Security posture, per docs/agents/agent-gateway.md: Marquetta never touches
-- these tables directly. She calls bounded Gateway actions and the Gateway
-- derives workspace_id / user_id / created_by_agent_id from authenticated
-- context. The constraints below are defense in depth, NOT the boundary — the
-- boundary is the Gateway. Anything expressed only in a skill prompt is a
-- suggestion; anything expressed here survives a compromised prompt.
--
-- Note on scoping: these tables are WORKSPACE-scoped, not owner-scoped, and
-- this migration moves the two existing Content Studio tables to match.
--
-- The old owner-scoped model (auth.uid() = user_id) cannot work here for two
-- reasons. First, Marquetta is an agent with no auth.users row, so agent-created
-- content would have to be attributed to some human just to be visible. Second,
-- the review queue is explicitly a role — Autumn or a delegated team member —
-- and owner scoping makes one user's content invisible to everyone else on the
-- same team.
--
-- That second failure is not hypothetical: content_brands currently holds nine
-- rows, which is the same three brands seeded three separate times by three
-- different users in one workspace, each unable to see the others'. The
-- triplication is a symptom of the scoping model, not a seeding accident.
--
-- Three guards are deliberate and load-bearing:
--   1. content_library gains a 'review' status. Marquetta's ceiling is review;
--      only a human moves content past it.
--   2. Approved voice exemplars are immutable (trigger). An agent that can
--      curate its own gold-standard voice corpus is a feedback loop.
--   3. content_schedule separates proposal from release. Creating a row is
--      never publication authority.

-- ---------------------------------------------------------------------------
-- Content pillars — the brand-drift guard.
--
-- The most engaging pillar is rarely the one a brand is for. Without a target
-- mix, an engine tuned to response re-weights a brand one individually
-- reasonable post at a time, which per-post human review cannot catch.
-- ---------------------------------------------------------------------------
create table if not exists content_pillars (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id),
  -- Nullable: agent-authored rows have no auth user. Visibility comes from
  -- workspace_id, authorship from created_by_agent_id / user_id.
  user_id uuid references auth.users(id) on delete set null,
  brand_id uuid not null references content_brands(id) on delete cascade,
  key text not null,
  label text not null,
  target_pct integer not null check (target_pct between 0 and 100),
  framing_note text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, key)
);

-- ---------------------------------------------------------------------------
-- Seeds — lane 1 (capture). Raw material from real business events.
--
-- source_ref + source together form the idempotency key: an hourly cron must
-- not re-capture the same deal or task on every run.
-- ---------------------------------------------------------------------------
create table if not exists content_seeds (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id),
  -- Nullable: agent-authored rows have no auth user. Visibility comes from
  -- workspace_id, authorship from created_by_agent_id / user_id.
  user_id uuid references auth.users(id) on delete set null,
  brand_id uuid references content_brands(id) on delete set null,
  pillar_id uuid references content_pillars(id) on delete set null,
  source text not null check (source in ('deal', 'agent_task', 'repo', 'dm', 'manual')),
  source_ref text,
  raw text not null,
  angle text,
  score integer not null default 0 check (score between 0 and 100),
  status text not null default 'new' check (status in ('new', 'drafted', 'dismissed')),
  source_task_id uuid references agent_tasks(id) on delete set null,
  created_by_agent_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, source, source_ref)
);

-- ---------------------------------------------------------------------------
-- Research — lane 2. Content and marketing research ONLY.
--
-- Real estate research (comps, ARV, rents, markets, buy box) belongs to Cash
-- and must never be written here. A finding without a source_url is an
-- opinion; expires_at exists because trend findings go stale and drafting from
-- a stale trend is worse than not drafting.
-- ---------------------------------------------------------------------------
create table if not exists content_research (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id),
  -- Nullable: agent-authored rows have no auth user. Visibility comes from
  -- workspace_id, authorship from created_by_agent_id / user_id.
  user_id uuid references auth.users(id) on delete set null,
  brand_id uuid references content_brands(id) on delete set null,
  topic text not null,
  finding text not null,
  source_url text,
  is_sourced boolean not null default false,
  expires_at timestamptz,
  source_task_id uuid references agent_tasks(id) on delete set null,
  created_by_agent_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Voice exemplars — real posts used as few-shot examples at draft time.
--
-- A voice description is weaker than voice samples. This table is the single
-- highest-leverage input to draft quality, which is exactly why the agent may
-- only PROPOSE rows here. Promotion to 'approved' is a human act, and an
-- approved row is immutable (see trigger below).
-- ---------------------------------------------------------------------------
create table if not exists content_voice_exemplars (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id),
  -- Nullable: agent-authored rows have no auth user. Visibility comes from
  -- workspace_id, authorship from created_by_agent_id / user_id.
  user_id uuid references auth.users(id) on delete set null,
  brand_id uuid not null references content_brands(id) on delete cascade,
  platform text,
  text text not null,
  -- false = counter-example: this is what the brand must NOT sound like.
  is_positive boolean not null default true,
  status text not null default 'candidate' check (status in ('candidate', 'approved', 'rejected')),
  proposed_by_agent_id uuid,
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Approved exemplars are frozen. Demotion back to candidate/rejected stays
-- possible (a human may retire one), but the content itself cannot be edited
-- while approved, and cannot be edited on the way out either.
create or replace function content_voice_exemplars_freeze_approved()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'approved' then
    if new.text is distinct from old.text
       or new.is_positive is distinct from old.is_positive
       or new.brand_id is distinct from old.brand_id
       or new.platform is distinct from old.platform then
      raise exception
        'approved voice exemplar % is immutable; demote it before editing', old.id;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists content_voice_exemplars_freeze on content_voice_exemplars;
create trigger content_voice_exemplars_freeze
  before update on content_voice_exemplars
  for each row execute function content_voice_exemplars_freeze_approved();

-- ---------------------------------------------------------------------------
-- Schedule — lane 5. Proposal and release are separate acts.
--
--   draft/review  -> Marquetta may set these
--   released      -> human only. This is the publication authority boundary.
--   publishing /
--   published /
--   failed        -> publish worker only
--
-- The publish worker must refuse anything that is not explicitly 'released'.
-- Creating a schedule row is a proposal, never a release.
-- ---------------------------------------------------------------------------
create table if not exists content_schedule (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id),
  -- Nullable: agent-authored rows have no auth user. Visibility comes from
  -- workspace_id, authorship from created_by_agent_id / user_id.
  user_id uuid references auth.users(id) on delete set null,
  brand_id uuid references content_brands(id) on delete set null,
  content_id uuid not null references content_library(id) on delete cascade,
  platform text not null,
  scheduled_for timestamptz,
  status text not null default 'draft'
    check (status in ('draft', 'review', 'released', 'publishing', 'published', 'failed')),
  review_assignee uuid references auth.users(id),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  -- A rejection reason is voice training data, not just a status change.
  rejection_reason text,
  released_by uuid references auth.users(id),
  released_at timestamptz,
  published_url text,
  metrics jsonb,
  failure_reason text,
  created_by_agent_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (content_id, platform)
);

-- ---------------------------------------------------------------------------
-- Extend the existing Content Studio tables.
-- ---------------------------------------------------------------------------

-- 'review' is Marquetta's ceiling: she drafts, a human moves it onward.
alter table content_library drop constraint if exists content_library_status_check;
alter table content_library add constraint content_library_status_check
  check (status in ('draft', 'review', 'approved', 'posted', 'archived'));

alter table content_library
  add column if not exists pillar_id uuid references content_pillars(id) on delete set null,
  add column if not exists seed_id uuid references content_seeds(id) on delete set null,
  add column if not exists source_video_url text,
  add column if not exists clip_range text,
  add column if not exists review_assignee uuid references auth.users(id),
  add column if not exists created_by_agent_id uuid,
  add column if not exists updated_at timestamptz not null default now();

-- Capture eligibility is opt-in, per ChatGPT's gateway review and correctly so:
-- completed agent_tasks routinely contain engineering, finance, security and
-- internal strategy material. A blanket read over completed tasks would hand
-- all of that to a content agent. Only explicitly flagged tasks are visible to
-- the capture lane, and the Gateway must return a sanitized projection rather
-- than raw context/result.
alter table agent_tasks
  add column if not exists content_capture_eligible boolean not null default false;

-- ---------------------------------------------------------------------------
-- Indexes for the access patterns the lanes actually use.
-- ---------------------------------------------------------------------------
create index if not exists content_seeds_brand_status_idx
  on content_seeds (brand_id, status, created_at desc);
create index if not exists content_research_brand_idx
  on content_research (brand_id, created_at desc);
create index if not exists content_voice_exemplars_brand_status_idx
  on content_voice_exemplars (brand_id, status);
create index if not exists content_schedule_status_idx
  on content_schedule (status, scheduled_for);
create index if not exists content_pillars_brand_idx
  on content_pillars (brand_id, sort_order);
create index if not exists agent_tasks_content_capture_idx
  on agent_tasks (content_capture_eligible, completed_at desc)
  where content_capture_eligible;

-- ---------------------------------------------------------------------------
-- RLS. Workspace-scoped via the existing public.get_user_workspace_id() helper,
-- so every member of the workspace sees the same content and the review queue
-- can be handed to a team member. The Gateway uses the service role and enforces
-- workspace scoping itself.
--
-- Every new table gets RLS ENABLED. Leaving it off is how workspace_settings
-- ended up publicly readable with the anon key.
-- ---------------------------------------------------------------------------
alter table content_pillars enable row level security;
alter table content_seeds enable row level security;
alter table content_research enable row level security;
alter table content_voice_exemplars enable row level security;
alter table content_schedule enable row level security;

drop policy if exists content_pillars_own on content_pillars;
drop policy if exists content_pillars_workspace on content_pillars;
create policy content_pillars_workspace on content_pillars
  for all using (workspace_id = public.get_user_workspace_id())
  with check (workspace_id = public.get_user_workspace_id());

drop policy if exists content_seeds_own on content_seeds;
drop policy if exists content_seeds_workspace on content_seeds;
create policy content_seeds_workspace on content_seeds
  for all using (workspace_id = public.get_user_workspace_id())
  with check (workspace_id = public.get_user_workspace_id());

drop policy if exists content_research_own on content_research;
drop policy if exists content_research_workspace on content_research;
create policy content_research_workspace on content_research
  for all using (workspace_id = public.get_user_workspace_id())
  with check (workspace_id = public.get_user_workspace_id());

drop policy if exists content_voice_exemplars_own on content_voice_exemplars;
drop policy if exists content_voice_exemplars_workspace on content_voice_exemplars;
create policy content_voice_exemplars_workspace on content_voice_exemplars
  for all using (workspace_id = public.get_user_workspace_id())
  with check (workspace_id = public.get_user_workspace_id());

drop policy if exists content_schedule_own on content_schedule;
drop policy if exists content_schedule_workspace on content_schedule;
create policy content_schedule_workspace on content_schedule
  for all using (workspace_id = public.get_user_workspace_id())
  with check (workspace_id = public.get_user_workspace_id());

-- ---------------------------------------------------------------------------
-- Bring the two existing Content Studio tables onto workspace scoping.
--
-- Order matters: backfill any missing workspace_id BEFORE swapping the policy,
-- or rows with a null workspace_id become invisible to everyone the moment the
-- new policy takes effect.
-- ---------------------------------------------------------------------------
update content_brands b
   set workspace_id = p.workspace_id
  from profiles p
 where b.workspace_id is null
   and p.user_id = b.user_id;

update content_library l
   set workspace_id = p.workspace_id
  from profiles p
 where l.workspace_id is null
   and p.user_id = l.user_id;

-- Deduplicate brands, keeping the earliest row per (workspace, name).
--
-- Safe to run now and only now: the duplicates exist because each user could
-- only see their own copy, and content_library does not yet reference any of
-- them. The guard below keeps that true rather than assuming it -- a brand with
-- content attached is never deleted, even if it looks like a duplicate.
delete from content_brands dup
 using content_brands keep
 where dup.name = keep.name
   and dup.workspace_id = keep.workspace_id
   and dup.created_at > keep.created_at
   and not exists (
     select 1 from content_library cl where cl.brand_id = dup.id
   );

alter table content_brands enable row level security;
alter table content_library enable row level security;

drop policy if exists content_brands_own on content_brands;
drop policy if exists content_brands_workspace on content_brands;
create policy content_brands_workspace on content_brands
  for all using (workspace_id = public.get_user_workspace_id())
  with check (workspace_id = public.get_user_workspace_id());

drop policy if exists content_library_own on content_library;
drop policy if exists content_library_workspace on content_library;
create policy content_library_workspace on content_library
  for all using (workspace_id = public.get_user_workspace_id())
  with check (workspace_id = public.get_user_workspace_id());

-- Prevent the triplication from recurring: one brand name per workspace.
create unique index if not exists content_brands_workspace_name_key
  on content_brands (workspace_id, name);
