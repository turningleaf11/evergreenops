---
name: dispatching-to-dex
description: How Claude hands routine coding work to Dex instead of doing it directly. Read this before creating an agent_tasks row for dex.
---

# Dispatching work to Dex

Dex's own definition (`docs/agents/dex-SKILL.md`) describes what Dex does once it
starts a task. It does not describe how a task gets **queued** for Dex in the first
place — that's this document's job, for whichever Claude session is doing the
queuing.

---

## 1. Decide it's actually a Dex task

Not a formality — getting this wrong either wastes Dex's run on something it'll
botch, or burns Claude's effort on something that didn't need it.

**Send to Dex when:**
- A pattern already exists in the codebase to copy — "add a field and its form
  input, following how `X` was done"
- It's mechanical: CRUD scaffolding, wiring an existing edge-function pattern to
  a new table, a scoped extraction like the Napkin document-extraction build
- No architecture, security, or data-model judgment call happens mid-build
- A human reviewing the diff before `approved` is a real, sufficient safety net

**Keep with Claude when:**
- The requirements are still being discovered in conversation, not yet fixed
- It touches auth, RLS, or anything where a wrong guess ships before anyone
  would notice — see tonight's RLS audit as the reference case: guessing a
  policy name wrong silently no-op'd a security fix, and only reading the
  result back caught it. That class of mistake needs a human-paced, verify-
  after-every-step loop, which is what Claude is for and Dex is not built for.
- It spans multiple repos or needs holistic judgment about how pieces fit
- Getting it wrong is expensive to unwind (production data, a live auth model)

When genuinely unsure, default to Claude for the first pass and hand Dex the
next similar task once the pattern is proven out.

---

## 2. Write the brief before touching the database

Dex hands this straight to a Codex subagent that has **no access to this
conversation** — vague input produces vague output. If the work is more than a
few sentences, write it as a proper scope file first (see
`docs/scopes/napkin-document-extraction.md` for the shape) and point the task
description at it rather than trying to cram the whole spec into one field.

A good brief names actual files, functions, and variables — not "add a toggle
for X," but "add a `is_active` boolean to `scorecard_metrics`, default `true`,
and a `Switch` in `MetricRow.tsx` bound to it, following the pattern in
`OrbitMembershipControl.tsx`."

---

## 3. Create the task

```
POST /agent_tasks
{
  "title": "<short title>",
  "description": "<the brief, or a pointer to the scope file>",
  "assigned_to": "dex",
  "status": "pending",
  "priority": "normal",
  "type": "code",
  "repo": "<evergreenops | evergreen-team-hub | ...>"
}
```

`status: "pending"` here means *queued, not yet started* — distinct from the
`"doing"` status Dex itself sets once a Codex session actually begins. Creating
a task at `"doing"` before any work has happened would misrepresent state to
anyone reading the board.

Log it the same way any agent write is logged:

```
POST /ai_logs
{ "task_id": "<id>", "agent_name": "claude",
  "category": "task_queued", "message": "Queued for Dex: <title>" }
```

---

## 4. Say so, out loud

A queued row is not a finished handoff — see §5. End the turn by telling Autumn
plainly what was queued and that it's waiting on a trigger, e.g.:

> Queued for Dex: "Add rule_type filter to the deal export." It's sitting in
> `agent_tasks` at `pending` — Albus needs to be told to check, since nothing
> currently polls for this automatically.

Never imply the work is progressing when it's actually just sitting in the
table.

---

## 5. The trigger — confirmed via Cash's setup

Cash was converted from a skill to an **agent** on 2026-08-13, and the shape is
now known precisely (relayed from Albus, then verified against the tables
directly rather than trusted on report):

- The skill file (`docs/agents/cash-SKILL.md`) stays the instruction set — an
  agent doesn't replace a skill, it wraps one with independent execution.
- Cash is registered in Albus's fleet (`SOUL.md`), not only invoked ad hoc.
- A **cron heartbeat polls `agent_tasks` every 30 minutes** for rows where
  `assigned_to='cash'` and `status='pending'`, and runs the skill against
  whatever it finds.
- Structured task input rides in the task's **`notes` column as JSON**
  (e.g. `{"property_address": "...", "asset_class": "fix_flip"}`) — separate
  from `title`/`description`, which stay human-readable.
- Verified 2026-08-13: two real screens ran end to end, both correctly capped
  at `status: review`, with proper `ai_logs` entries. One real gap found —
  `underwriting_runs` wasn't being written despite the skill saying it's
  mandatory. Fixing that is Albus-side, not something this doc controls.

**Dex is expected to follow the same path** — an agent registration plus its own
30-minute-class heartbeat polling for `assigned_to='dex'`. Until that's live,
treat a queued Dex task as needing a manual nudge to Albus, the same as before.
Once it's confirmed live, update this section to say so and drop the caveat —
don't leave it here as permanent hedging once the fact is known.

Put structured task input in `notes`, not `description`, to match the pattern
Cash already uses — a future agent conversion for Dex will likely expect the
same shape.
