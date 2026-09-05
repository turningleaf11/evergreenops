# OpsHQ — Design & Code Conventions

This file is read by Claude at the start of every session. Follow these rules exactly.
Do not invent new patterns when existing ones cover the case.

---

## SESSION START PROTOCOL

This is two-tier. Figure out which tier you're in before doing anything else.

**Quick/one-off session** (a single question, lookup, or small fix with no
follow-on work expected): skip this whole protocol. Just do the task.

**Build/planning session** (anything where you're picking up ongoing work —
writing code, planning a feature, resuming something from a prior session):
run steps 1-2 first.

### 1. Check your task queue (AI Hub)
```sql
-- Run against Supabase project: dsxrekabnwvarnroanny
SELECT title, status, priority, description FROM agent_tasks
WHERE assigned_to = 'claude' AND status NOT IN ('done', 'cancelled')
ORDER BY created_at DESC;
```

### 2. Read shared AI memory
```sql
SELECT agent_id, content, metadata, created_at FROM memories
ORDER BY created_at DESC LIMIT 8;
```

### Miro Task Board — not a default read
Miro board: https://miro.com/app/board/o9J_lUDcK7Q=/. Do not read any frame at
session start. Check it only when the user references it directly or a task
explicitly points there:
- **Task Board**: https://miro.com/app/board/o9J_lUDcK7Q=/?moveToWidget=3458764674825465445
- **Notes**: https://miro.com/app/board/o9J_lUDcK7Q=/?moveToWidget=3458764675448531014
- Business Map — Birds Eye View: `?moveToWidget=3458764674708214793`
- AI-First Function Map: `?moveToWidget=3458764674717195454`
- Evergreen Business Flow: `?moveToWidget=3458764674789723041`
- GHL Seller Funnel: `?moveToWidget=3458764675448621890`

### 3. Write a memory entry when you learn something new
```sql
INSERT INTO memories (agent_id, content, metadata)
VALUES ('claude', '<what you learned>', '{"type": "session_note", "category": "<topic>"}');
```

### 4. Write a handoff note at END of a build/planning session
Before the session closes, write one memory entry summarizing:
- What was built/changed
- What's open/next
- Any decisions made

Skip this for quick/one-off sessions — nothing to hand off.

### 5. Update the docs site if the business or system changed

**Documentation lives in `turningleaf11/evergreen-dev-docs`** → published at
**https://evergreen-dev-docs.vercel.app**. VitePress, markdown, deploys from `main`.
It is NOT in this repo. Clone it when you need to change it.

Update the relevant page in the SAME session that changes what it describes — a
page updated later is a page that drifts, which is the exact failure this file
exists to prevent.

| Page | File in the docs repo |
|---|---|
| Business map hub | `docs/business/index.md` |
| DTS lead flow | `docs/business/dts-lead-flow.md` |
| Buy box | `docs/business/buy-box.md` |
| Ecosystem map | `docs/systems/index.md` |
| Supabase projects + ownership risk | `docs/systems/supabase-projects.md` |
| AI ops — how it fits together | `docs/systems/ai-ops.md` |
| Agent fleet | `docs/systems/agent-fleet.md` |
| Cash · Dex | `docs/systems/cash.md` · `docs/systems/dex.md` |

Run `npm run docs:build` before pushing — it catches dead links.

Adding a domain page means adding it to the sidebar in
`docs/.vitepress/config.ts` and linking it from the relevant hub.

> The old claude.ai artifacts are retired and now redirect to the site. Don't
> publish map pages as artifacts again — one home only.

**Conventions these pages follow** (from how Autumn maps processes — match it):
- Swimlanes by **function**, not by time
- **Owner badges** on every step; who does it is first-class, never implied
- **Tool chips** on the step that uses the tool
- Decision exits shown **including dead ends** — the "no" branch is where leads die
- Two views per domain: a **flow** (how it moves) and a **stage register**
  (stage → owner → what happens → what's missing)
- Gaps written **into the stage**, not filed separately
- Every node states whether it's automated, manual, or unmapped. A step that exists
  but isn't documented is drawn dashed, so the hole is visible rather than absent.

---

## Deploys, branches and migrations

Full explanation, written for Autumn rather than for engineers:
**`docs/how-deploys-work.md`**. Read it before answering any question about
merging, deploys, or why something isn't live yet — and point her to it rather
than re-explaining from scratch.

The rules that bind every session:

1. **Migrations reach production by merging to `main`, never by hand.**
   `supabase db push` runs from CI on merge. Applying directly puts production
   ahead of the repo, which is drift, and the deploy then fails closed until the
   file is committed.
2. **Supabase's `apply_migration` assigns its own timestamp** and does not
   report it. Anyone who applies outside CI gets a filename/ledger mismatch by
   default. If it happens, read the real version back from
   `supabase_migrations.schema_migrations` and rename the file to match, at once.
3. **A fix to the deploy process merges together with the work that needs it.**
   A fix stranded on a branch protects nothing.
4. **Autumn decides when to merge.** Never merge without her asking. When merge
   order genuinely matters, say so explicitly and say why — she has told us she
   is new to this and should not have to infer it.
5. **More than one session runs at a time.** Before schema work, check
   `schema_migrations` for versions that are not in the repo; another session may
   be mid-flight. Say what someone else's branch is doing rather than guessing.

---

## Cost & usage discipline

- **One topic per session.** Don't run unrelated work (e.g. a build task and a
  strategy discussion) in the same thread — close a session out once its task
  ships rather than leaving it open for unrelated follow-ups days later.
- **Default to Sonnet.** Only reach for Opus when a task is genuinely stuck on
  reasoning, not as a standing habit.
- **Narrow tool calls at the call site.** When pulling from Vercel, Supabase,
  GitHub, etc., ask for the specific field or a capped/filtered result — don't
  fetch a full listing and read past what's needed.
- **Edit, don't republish.** Iterate on artifacts and docs with targeted diffs
  instead of resending a full file on every round.

---

## AI Team context

| Agent | Role | Assigned_to key | Engine |
|---|---|---|---|
| Claude | Integrator / COO / builder | `claude` | Claude |
| Albus | Orchestrator / Chief of Staff | `albus` | OpenClaw gateway |
| Cash | Underwriting + market research | `cash` | OpenClaw agent — cron heartbeat (30 min) runs the `cash` skill against `agent_tasks` |
| Dex | Jr. Coder | `dex` | OpenClaw skill → spawns Codex |
| Codex | Coding tasks | `codex` | OpenAI Codex |

Tasks flow through `agent_tasks` table. Results written back to `result` column.
Supabase project: `dsxrekabnwvarnroanny`

**Agent skill definitions live in `docs/agents/`** — those are the canonical copies.
The running versions sit at `~/.openclaw/skills/<name>/SKILL.md` inside Albus's
Docker container, which is *not* version-controlled. See `docs/agents/INSTALL.md`
before changing agent behavior.

**Claude's integrator posture is `docs/agents/claude-integrator-SKILL.md`.** Read
it in any strategy, planning, or new-venture session. Its 90-day rules override
the urge to build.

### Two rules that apply to every agent

1. **Persistence is mandatory.** A result that only appears in chat did not happen.
   Write to `agent_tasks.result`, log to `ai_logs`, and for underwriting also to
   `underwriting_runs`. The entire fleet was previously non-functional for exactly
   this reason — the skills ran fine and wrote nothing.
2. **Status ceiling is `review`, never `approved`.** Setting `approved` fires a real
   GitHub Actions build against the repo. That's a human's call, or Albus's — never
   the agent that produced the work.

### Underwriting tables

| Table | Purpose |
|---|---|
| `buy_box_criteria` | Structured buy box, per asset class. `rule_type` = screen (pass/fail) or pricing (governs the offer, never rejects). `hardness` = hard/soft, applies to screen rows. Source of truth mirrors buybox.evergreenreventures.com |
| `buy_box_exceptions` | Documented exceptions. `widened_band` = threshold relaxed; `conditional_adjustment` = curable, price it and flag for a human — never auto-waive |
| `underwriting_runs` | Cross-app index of every underwrite: which tool, which record, deep link, verdict, headline metrics. `actual_*` columns exist for later predicted-vs-actual calibration |

Markets differ by strategy: **Fix & Flip is Miami-Dade + Broward only**; Buy & Hold
spans FL, TX, TN, GA, NC, VA, AL, KY. Don't collapse the two.

---

## Miro — editable frames (can update these)
- Task Board — track work status
- GHL Seller Funnel — funnel/automation design
- AI-First Function Map — automation tier assignments
- Business Map — Birds Eye View — business strategy overview

---

---

## Stack

- React + TypeScript + Vite
- Tailwind CSS with shadcn/ui components
- Supabase (auth + DB). Multi-tenant via `workspace_id`.
- TipTap rich text editor (`RichTextEditor` component)
- ReactFlow (`@xyflow/react`) for process map canvases
- `sonner` for toasts (import from `"sonner"`, not `"@/hooks/use-toast"`)

---

## Design alignment — before generating any visual work

Don't jump straight to a mockup or artifact. Autumn doesn't always know what
she wants up front, so guessing and iterating round-by-round is expensive and
usually wrong. Instead, run one short question pass first — via
`AskUserQuestion` where it fits — covering only what's actually undecided:

- Purpose/audience: what is this for, who sees it
- Must-have content or functionality
- Style reference: a link, an existing page in the app, or a couple of
  adjectives — not a blank "what do you want it to look like"
- Anything explicitly out of scope for this round

Don't ask about things the design system already answers (colors, spacing,
card patterns, pill components, etc. — see below) — those aren't open
questions. One alignment pass, then one full mockup, then one round of
complete feedback before shipping — not one change per round.

---

## Design System

### Token usage — ALWAYS use CSS variables, NEVER hardcode colors

```tsx
// ❌ WRONG — breaks in dark mode
className="bg-red-100 text-red-800"
className="bg-yellow-100 text-yellow-800"
className="bg-green-100 text-green-800"
className="bg-blue-100 text-blue-800"

// ✅ CORRECT — use semantic tokens
className="bg-destructive/10 text-destructive"
className="bg-amber-500/10 text-amber-700 dark:text-amber-400"
className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
className="bg-blue-500/10 text-blue-700 dark:text-blue-400"
```

### StatusPill / PriorityPill — the ONLY way to render status/priority chips

```tsx
import { StatusPill, PriorityPill } from "@/components/primitives";

// Read-only status chip
<StatusPill kind="task" value={status} size="sm" />

// Editable status dropdown (pass onChange — StatusPill renders its own DropdownMenu)
<StatusPill kind="project" value={project.status} onChange={v => updateProject({ status: v })} />

// Editable priority dropdown
<PriorityPill value={task.priority} onChange={v => update({ priority: v })} />
```

All entity kinds: "goal" | "project" | "task" | "issue" | "deal" | "lead" | "transaction" | "contact" | "thread"
Status values per kind are registered in `src/lib/statusTone.ts` — add new statuses there, not inline.
The TASK kind includes both human and agent task stages (todo/in_progress/blocked/done + backlog/pending/doing/review/approved/needs_input/cancelled).

Never define local `statusConfig`, `priorityLabels`, or badge color maps in page components.
Never use `StatusBadge` for new code — it remains only as a legacy reference for process-map node types.

### CSS utility classes (use these, don't reinvent them)

| Class | Use |
|---|---|
| `.crm-card` | Standard card surface (`rounded-xl bg-card p-6 border shadow-sm`) |
| `.crm-card-muted` | Muted/secondary card |
| `.crm-eyebrow` | Section label above a group (`11px bold uppercase tracking-wide muted`) |
| `.crm-field-label` | Field label above an input |
| `.crm-section-stack` | Vertical spacing between card sections (32px) |
| `.crm-field-stack` | Vertical spacing between fields (16px) |
| `.elevation-1/2/3` | Programmatic box-shadow (prefer CSS var-based, not raw `shadow-*`) |
| `.page-title` | Top-level page heading (`text-3xl font-bold tracking-tight`) |
| `.section-title` | Section heading within a page |

### Card patterns

Cards are **click targets** — the whole card opens a detail view. Never put expanding panels inside cards.

```tsx
// Standard interactive card
<div
  onClick={onOpen}
  className="rounded-xl border bg-card hover:shadow-lg hover:-translate-y-px transition-all cursor-pointer"
  style={{ borderLeft: `3px solid ${typeColor}` }}
>
```

Action menus go in a `...` (MoreHorizontal) button. No inline action buttons on cards.

### Typography scale

- Page title: `text-3xl font-bold tracking-tight` (use `.page-title`)
- Section heading: `text-lg font-bold tracking-tight` (use `.section-title`)
- Card name / primary content: `text-[15px] font-semibold tracking-tight`
- Secondary text / metadata: `text-xs text-muted-foreground`
- Eyebrow label: `.crm-eyebrow` (never use a raw `text-xs uppercase`)

### Spacing

- Page content padding: `px-6 py-6` or `p-6`
- Card internal padding: `p-4` (compact) or `p-6` (standard)
- Between sections on a page: use `.crm-section-stack` or `space-y-8`
- Between fields in a form: use `.crm-field-stack` or `space-y-4`

---

## Component conventions

### RichTextEditor

```tsx
// Full-page notes editor
<RichTextEditor content={html} onChange={fn} borderless />

// Inside a sheet/panel (NOT compact — use minHeight instead)
<RichTextEditor content={html} onChange={fn} borderless minHeight="240px" />

// Tiny inline composer
<RichTextEditor content={html} onChange={fn} compact />
```

Never use `compact` inside a sheet or detail panel — it's too small and feels cheap.

### Empty states

Use `<EmptyState />` from `@/components/shared/EmptyState`. Don't write bare italic text.

### Toasts

```tsx
import { toast } from "sonner";
toast.success("Saved"); toast.error(error.message);
```

---

## Database conventions

- Every table has `workspace_id` — always filter by it.
- Auth user key in `profiles` table is `user_id` (NOT `id`). Always `select("user_id, full_name, avatar_url")`.
- `process_buckets` is self-referential — `parent_id` = sub-process parent.

---

## UX/Premium quality bar

This app targets Fortune-500-quality SaaS polish. Before shipping any UI:

1. **Dark mode**: every color must work in dark mode (use CSS vars, not hardcoded hex/rgb)
2. **Empty states**: every list/table has a meaningful empty state
3. **Loading states**: use `Loader2 animate-spin` while data loads, never blank
4. **No inline text actions**: actions live in `...` menus or hover-reveal buttons
5. **Consistent card structure**: name/title is the hero, metadata is secondary, owner/date is footer
6. **No pill labels for state changes**: use visual treatment (opacity, border color, icon swap) not badge stacking

---

## Files to know

| Path | Purpose |
|---|---|
| `src/index.css` | All CSS variables (light + dark), utility classes |
| `tailwind.config.ts` | Token → Tailwind class mappings |
| `src/components/primitives/StatusPill.tsx` | Status chip — use everywhere for entity status |
| `src/components/primitives/PriorityPill.tsx` | Priority chip — use everywhere for priority |
| `src/lib/statusTone.ts` | HSL tone registry backing StatusPill/PriorityPill |
| `src/components/shared/EmptyState.tsx` | Shared empty state |
| `src/components/RichTextEditor.tsx` | TipTap rich text with slash commands |
| `src/components/SlashCommandMenu.tsx` | Slash command menu for RichTextEditor |
| `src/lib/processMap.ts` | ProcessBucket CRUD + canvas helpers |
