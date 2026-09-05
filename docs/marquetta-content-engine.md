# Marquetta — Content Engine Build Plan

Status: **plan, awaiting go-ahead.** Nothing in this document has been built
except the two fixes noted in §5.

Decided in the 2026-09-05 content strategy session with Autumn.

---

## 1. What we are building

A mostly-automated content engine, operated by a new fleet agent (**Marquetta**),
built as an extension of the **existing Content Studio in OpsHQ** — not a new app
and not a new repo.

Sequencing context: the AI infrastructure work (Ema, Cash, Albus) came first by
deliberate choice. Content Studio was built in May and has not been used yet
because attention was elsewhere. Marketing is now the active lane.

### Decisions locked

| Decision | Choice |
|---|---|
| Where it lives | Extend the existing Content Studio in OpsHQ |
| Architecture | **Brand-agnostic pipeline.** Adding a brand is a row, not a code change |
| First brand tuned | Autumn Alexander — get the voice right here first |
| Research scope | Content/marketing research only. Real estate research stays with Cash |
| Video clipping | **Buy and orchestrate** (Opus Clip / Descript). Do not build cutting in OpsHQ |
| Publishing | Human release required. Marquetta never auto-publishes |
| Review owner | A role (`review_assignee`) — Autumn or a delegated team member, per brand |
| Platforms | Facebook + Instagram today; add LinkedIn. TikTok and blog already stubbed |
| Video storage | Google Drive folder as the video library. Do not build storage or an upload UI |
| Agent build track | Same fleet pattern as Ema/Cash — OpenClaw skill + Agent Gateway scope. Not a separate stack |
| Brand positioning | Autumn is a **real estate investor/operator first**. Enforced by pillar mix, see below |

### The design principle

The prior version generated captions and nothing downstream existed. Generation
was never the hard part. **Capture (lane 1) and publish/measure (lane 5) are
where this engine earns its keep**, and they are the two stages that do not
exist yet. Build outward from the middle, but do not stop at the middle.

---

## 2. Current state

Already built and working:

| Piece | Path |
|---|---|
| Content Studio page | `src/pages/ContentStudioPage.tsx` |
| Brand manager | `src/components/content-studio/BrandManager.tsx` |
| Generator | `src/components/content-studio/ContentGenerator.tsx` |
| Library | `src/components/content-studio/ContentLibrary.tsx` |
| Data hooks | `src/hooks/useContentStudio.ts` |
| Generation function | `supabase/functions/content-generate/index.ts` |
| Tables | `content_brands`, `content_library` |

Three brands are configured: Autumn Alexander (personal), Evergreen Home Group
(seller-facing, 8 states), Evergreen RE Ventures (buyers/capital/JV).

`content_library` currently has zero rows — see §5.

---

## 3. Schema additions

All tables carry `workspace_id` and filter by it, per repo convention. All
content rows carry `brand_id` — nothing in this pipeline is brand-free.

### `content_seeds` — lane 1
Raw material captured from real business events.

| Column | Notes |
|---|---|
| `brand_id` | FK `content_brands` |
| `source` | `deal` \| `agent_task` \| `repo` \| `dm` \| `manual` |
| `source_ref` | id / URL of the originating record |
| `raw` | the event as captured |
| `angle` | one-line content angle |
| `score` | specificity score, rule-based for now |
| `status` | `new` \| `drafted` \| `dismissed` |

### `content_research` — lane 2
Content/marketing findings only. Never real estate research.

| Column | Notes |
|---|---|
| `brand_id` | nullable — some findings are platform-wide |
| `topic`, `finding`, `source_url` | a finding with no source is an opinion; label it |
| `expires_at` | trend findings go stale; do not draft from expired rows |

### `content_voice_exemplars` — voice fidelity
Real published posts per brand, used as few-shot examples at draft time.
A voice description is weaker than voice samples. This is the single highest-leverage
table for making the Autumn Alexander brand actually sound like Autumn.

| Column | Notes |
|---|---|
| `brand_id`, `platform`, `text` | the real post |
| `is_positive` | true = sounds right; false = counter-example, avoid this |

### `content_pillars` — brand drift guard
Per-brand pillars with a target share of output. Marquetta plans against the
mix rather than against what performed best, and reports the running mix with
every queued batch.

| Column | Notes |
|---|---|
| `brand_id`, `key`, `label` | e.g. `deals_operating` |
| `target_pct` | target share of output |
| `framing_note` | how this pillar must be written — see the Autumn constraint below |

`content_seeds` and `content_library` each carry a `pillar_id`.

**Why this is a table and not a guideline.** The most engaging pillar is rarely
the one the brand is for. Autumn's build/AI content gets the strongest response,
which means any engine tuned to response will re-weight her personal brand into
an AI-guru brand — and it will do it one individually-reasonable post at a time,
which is exactly what per-post human review cannot catch. Drift is a volume
problem, so the guard is a volume guard.

Autumn Alexander target mix: `deals_operating` 50%, `building_systems` 20%,
`team_bts` 20%, `personal_reactive` 10%. Framing rule on `building_systems`:
the build content is *evidence that she operates well*, not a product category.
A post about the underwriting agent that screens her deals is a real estate
post; "5 ways AI is changing real estate" is not one to write.

This also protects Build Notes commercially — the teardowns are worth paying for
because she is a practitioner, not an educator.

### `content_schedule` — lane 5
| Column | Notes |
|---|---|
| `content_id` | FK `content_library` |
| `platform`, `scheduled_for` | |
| `status` | `queued` \| `approved` \| `published` \| `failed` |
| `review_assignee` | who releases it |
| `reviewed_by`, `reviewed_at`, `rejection_reason` | rejections are voice training data |
| `published_url`, `metrics` | read back after publish |

### `content_library` additions
`seed_id`, `source_video_url`, `clip_range`, `review_assignee`, `brand_id`
already exists.

---

## 4. Build phases

Ordered so something real ships at the end of each phase.

> **Build order note.** The phases below are the product view. The security
> build order, which governs implementation sequence, is: content schemas +
> human-release constraints → task claim/result RPCs → capture projections →
> Gateway action contracts and dispatch → Marquetta permission migration → MCP
> schemas and conditional tool registration → hashed credential →
> `MARQUETTA_GATEWAY_TOKEN` into OpenClaw → exact tool allowlist → **verify live
> tool registration** → `system_whoami` acceptance → one bounded task acceptance
> → enable cron. Do not skip the registration verification step.
>
> **Step 1 is done:** `supabase/migrations/20260905180000_marquetta_content_engine.sql`
> (written, not yet applied).

**Phase 0 — repairs (half a day).** Fix the model-ID bug (§5), dedupe the brand
rows, confirm a caption generates and saves end to end. Until this passes,
nothing else is worth building.

**Phase 1 — voice (1 day).** Add `content_voice_exemplars`. Load 20–40 of
Autumn's real posts. Feed them to `content-generate` as few-shot examples.
Success test: generate 10 drafts, Autumn can't reliably tell which are hers.
This phase is the whole ballgame for the personal brand — do not rush it.

**Phase 2 — review queue (2 days).** `content_schedule` plus a review UI in
Content Studio. Batch approve/reject with reason. Assignable. Nothing publishes
yet — this is the human gate, built before the thing it gates.

**Phase 3 — capture (2–3 days).** `content_seeds` plus the capture worker
reading closed deals, completed `agent_tasks` and repo activity. Seeds land in
the studio as one-click draft starters. This is where the engine stops needing
Autumn to think of topics.

**Phase 4 — Marquetta proper (2 days).** Install `marquetta-SKILL.md` into
Albus's container per `docs/agents/INSTALL.md`, add the cron heartbeat, wire the
lanes to `agent_tasks` with `assigned_to = 'marquetta'`. Persistence to
`ai_logs` and `agent_tasks.result` mandatory.

**Phase 5 — publish (2–3 days).** Publish worker for Facebook, Instagram and
LinkedIn. Credentials live with the worker, not the agent. Read metrics back.

**Phase 6 — clip (1–2 days).** Integrate the chosen external clipper. Point it
at the existing video backlog, file clips into the library as drafts. Bought,
not built.

**Phase 7 — research (1–2 days).** `content_research` plus a daily research
task. Deliberately last: it is the smallest lever, and it is worthless until
there is a pipeline to feed.

---

## 5. Bugs found while designing this

**a) The generator is almost certainly broken — and this may be why the library
is empty.** `ContentGenerator.tsx` offers three models with Lovable-gateway IDs
(`google/gemini-2.5-flash`, `google/gemini-2.5-pro`, `openai/gpt-5-mini`) and
passes the selected one straight through to `content-generate`, which calls
`api.openai.com` directly. OpenAI's API will reject all three — the default
(`gpt-4o-mini`) only applies when no model is sent, and the UI always sends one.
The function was migrated from the Lovable gateway to OpenAI and the model list
was never updated. **Fixed in this branch** by mapping the options to valid
OpenAI model IDs.

**b) Duplicate brand rows — root cause found.** `content_brands` held nine
rows: the same three brands seeded three separate times by **three different
users in one workspace**. Not a seeding accident. The old RLS policy was
owner-scoped (`auth.uid() = user_id`), so each user opened Content Studio, saw
nothing, and seeded their own set. Verified against production, then reproduced
in the regression fixture.

Fixed in the migration, together with the scoping change that caused it. The two
must ship together: the dedupe keeps one user's rows, so deduplicating without
moving to workspace-scoped RLS would leave every other member of the workspace
with an empty Content Studio. Confirmed in `supabase/tests/guards.sql` — under
the new policy a non-owning user sees 3 brands; under the old one, 0.

## 5c. Verification

The migration was executed against a throwaway Postgres 16 seeded with the real
triplicated brand state, not merely reviewed. All seven guards hold:
dedupe leaves 3 of 9 brands; a unique index blocks re-triplication;
workspace RLS makes another user's brands visible; `content_library` accepts
`review` and rejects unknown statuses; an approved voice exemplar cannot be
edited but can still be demoted by a human; a repeated capture of the same
source event is rejected; an unknown schedule status is rejected.

See `supabase/tests/` for the fixture, seed and assertions.

## 6. Where Marquetta gets built

Marquetta is built on the **same fleet pattern as Ema and Cash**, not on a
separate stack. The Agent Gateway is the security boundary and it is
model-agnostic: agents request named capabilities and never hold credentials.
Which assistant drafts a skill file does not change that, and a fourth agent
with a fourth access pattern would defeat the reason the gateway exists.

Two pieces are owned in two places:

- **Behaviour** — `docs/agents/marquetta-SKILL.md`, in this repo. Written.
- **Gateway capability scope** — to be defined against the existing gateway
  (see `docs/agents/agent-gateway.md`). Requested from the ChatGPT thread that
  built the gateway, since that thread holds the design context.

Marquetta's scope must be: read-only on business events (closed/contracted
deals, completed `agent_tasks`), write on the content tables only, **no CRM
write** (Ema's), **no underwriting** (Cash's), and **no publishing
credentials** — Meta/LinkedIn tokens live with the publish worker so Marquetta
can schedule but cannot post.

## 7. Video backlog

Currently a local folder, which nothing server-side can reach. Move it to a
**Google Drive folder** and treat that as the video library: Drive is already
connected, both candidate clippers ingest from it, and it avoids building
storage or an upload UI for a problem that does not need one.

Name files descriptively on upload (`2026-03-seller-call-objection-handling.mp4`,
not `IMG_4471.mov`) — Marquetta selects source video partly by filename, and
the clip lane is only as good as what it can identify.

## 8. Open questions

- Which clipper — Opus Clip or Descript? Descript is better if the clips need
  editing; Opus Clip is better if volume matters more than polish.
- Posting cadence: currently none, and inconsistent by Autumn's own account.
  Treat "a sustainable cadence exists at all" as an outcome of this build rather
  than an input to it — set a deliberately low starting cadence and let the
  review queue prove it can be met before raising it.
- The "how did you build that" audience stays under the Autumn Alexander brand.
  Decided 2026-09-05. It does not get its own brand row, and it is capped by the
  `building_systems` pillar rather than by judgement.
