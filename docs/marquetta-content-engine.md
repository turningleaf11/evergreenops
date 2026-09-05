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

**b) Duplicate brand rows.** `content_brands` holds nine rows — each of the
three brands seeded three times (2026-05-17, and twice on 2026-06-01). The
generator's brand picker will show every duplicate. Not fixed here, because
deleting rows is destructive and yours to approve. Suggested cleanup, keeping
the oldest of each name:

```sql
DELETE FROM content_brands a
USING content_brands b
WHERE a.name = b.name
  AND a.workspace_id = b.workspace_id
  AND a.created_at > b.created_at;
```

Run it against `dsxrekabnwvarnroanny` only after confirming nothing references
the newer ids (`content_library` is empty, so this is currently safe).

---

## 6. Open questions

- Which clipper — Opus Clip or Descript? Descript is better if the clips need
  editing; Opus Clip is better if volume matters more than polish.
- Where does the video backlog live, and what format? That decides phase 6's
  effort.
- Posting cadence and current volume per platform — needed to size the review
  queue and set the heartbeat frequency.
- Does the teaching/"how did you build that" audience stay under the Autumn
  Alexander brand, or does it get its own brand row now that the 90-day fence
  rules are removed?
