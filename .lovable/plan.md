

# CEO Brain Dump + Delegation Dashboard

## The idea

Add two new sections to the Strategy Command Center page:

1. **Scratch Pad** — A persistent, always-visible text area at the top of the strategy page where you jot anything: broken things, ideas, tasks, personal reminders, next projects. Like your physical notebook but digital. It auto-saves as you type. No structure required — just dump.

2. **"Process This" button** — When you're ready, hit the button. The AI reads your scratch pad, cross-references your current priorities/projects/team, and produces a **triage list**: each item extracted as a card categorized as Task, Decision, Idea, or Delegation. You review each card one by one — approve (creates the item in the system with assignee), edit, or dismiss. Nothing gets created until you confirm.

3. **Delegation Board** — A new collapsible section showing everything you've delegated, with a toggle between **By Person** (see each team member and their plate) and **By Status** (waiting, in progress, done, stuck). This pulls from existing tasks/projects where you're the creator but someone else is assigned.

## How it works

### Scratch Pad
- New `ceo_scratch_pad` table: `id`, `user_id`, `content` (text), `updated_at`
- Auto-saves on debounce (1.5s after typing stops)
- Renders as a large, minimal textarea with a notebook-like feel — no borders, just lines
- Persists between sessions

### Process This (AI Triage)
- New edge function `ceo-triage` that:
  - Takes the scratch pad text + current team roster + existing tasks/projects
  - Uses tool calling to return structured output: array of `{ text, category, suggested_assignee_id, suggested_priority, reasoning }`
- Frontend shows results as a scrollable list of cards, each with:
  - Category badge (Task / Decision / Idea / Delegation)
  - The extracted item text
  - Suggested assignee (dropdown to change)
  - Approve button → creates the task/decision in the system
  - Dismiss button → removes the card
- After processing, the scratch pad content stays (you can clear it manually)

### Delegation Board
- No new tables — queries existing `tasks` and `projects` where `created_by = current user` and `assigned_to != current user`
- **By Person view**: Groups items under each team member's name/avatar with count
- **By Status view**: Groups by status (todo, in_progress, done, blocked)
- Toggle switch at the top to flip between views
- Each item shows title, status badge, due date, priority dot

## Database
- **Migration**: Create `ceo_scratch_pad` table with RLS (admin-only read/write)

## Files

| Action | File |
|--------|------|
| Migration | Create `ceo_scratch_pad` table |
| New | `src/components/ScratchPad.tsx` — auto-saving textarea |
| New | `src/components/AiTriage.tsx` — triage results UI with approve/dismiss cards |
| New | `src/components/DelegationBoard.tsx` — by-person / by-status toggle view |
| New | `supabase/functions/ceo-triage/index.ts` — AI processing edge function |
| Edit | `src/pages/CeoDashboard.tsx` — add Scratch Pad, Process button, and Delegation Board sections |

## Start simple
This is V1. We keep the scratch pad as plain text (not structured). The AI triage is a one-shot process (not continuous). The delegation board is read-only. We can layer on more later: recurring auto-triage, drag-to-assign, follow-up reminders, etc.

