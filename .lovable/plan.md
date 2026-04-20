

## Three-phase roadmap

**Phase 1 — Mention Peek System** (this plan, build now)
**Phase 2 — Notes/Wiki Notion-class polish + backlinks** (next)
**Phase 3 — Home intranet redesign** (last; keeps AI companion, tasks, reminders, favorite docs, announcements, departments, forms)

---

## Phase 1: Mention Peek System (build now)

Goal: clicking an `@mention` chip never navigates away. It opens a contextual peek matched to entity type. User stays in flow.

### Peek behavior by type

| Type | Peek style | Source |
|---|---|---|
| **Person** | Right slideout (Sheet) — avatar, title, dept, contact, bio, skills, "Open profile" button | `profiles` |
| **Doc / Wiki** | Centered modal (Dialog, large) — rendered HTML read-only with cover/title/tags, "Open full doc" button | `documents` |
| **Note** | Centered modal (Dialog, medium) — read-only rendered note, "Open note" button | `notes` |
| **Task** | Right slideout — title, status, assignee, due, description, comments. Status/assignee editable inline | `database_rows` (tasks list) |
| **Project** | Right slideout — overview only (status, owner, due, description, top-level notes preview), "Open project" button | `projects` |
| **Goal** | Reuse existing `GoalPeek` component | `goals` |
| **Database record** | Right slideout — record fields rendered via existing `DatabaseRecordDetail` patterns | `database_rows` |

### New components

- **`src/components/mention-peek/MentionPeekProvider.tsx`** — React context exposing `openPeek(type, id)`. Holds active peek state.
- **`src/components/mention-peek/MentionPeekRoot.tsx`** — mounts at app root, renders the right peek surface (Sheet vs Dialog) for the active item.
- **`src/components/mention-peek/peeks/PersonPeek.tsx`** — Sheet content.
- **`src/components/mention-peek/peeks/DocPeek.tsx`** — Dialog content (used for `doc` and `note`; size varies).
- **`src/components/mention-peek/peeks/TaskPeek.tsx`** — Sheet content.
- **`src/components/mention-peek/peeks/ProjectPeek.tsx`** — Sheet content.
- **`src/components/mention-peek/peeks/RecordPeek.tsx`** — Sheet content; reuses logic from `DatabaseRecordDetail`.
- **`src/components/mention-peek/peeks/GoalPeek.tsx`** — thin wrapper around existing `execution/GoalPeek.tsx`.

### Edits

- **`src/App.tsx`** — wrap routes with `<MentionPeekProvider>` and mount `<MentionPeekRoot />` once.
- **`src/components/MentionClickHandler.tsx`** — replace `navigate(url)` with `openPeek(type, id)` when type is recognized; fall back to `navigate(url)` for unknown types or external URLs. Remove the existing person hover card (replaced by click-to-peek). Keep the global click capture so it works across the entire app, including inside docs.

### Mention chip URL/type mapping (already encoded by `UniversalMention`)

The chip already carries `data-mention-type` and `data-mention-id`. We just consume those. No edge function change.

### Files

- **New**: 6 files under `src/components/mention-peek/`.
- **Edited**: `src/App.tsx`, `src/components/MentionClickHandler.tsx`.

No DB changes. No new edge functions. No new secrets.

---

## Phase 2 (next plan): Notes/Wiki — Notion-class polish + backlinks

- Click below content → cursor jumps to end (extend editor click-target to fill the page).
- Cover image (upload + unsplash search) per doc/note, stored in a new `cover_url` column.
- Emoji icon picker (stored in `icon` column).
- Drag handle on every block (TipTap `dragHandle` extension or custom NodeView).
- Slash menu reorganized into categories (Basic / Media / Layout / Embeds).
- **Backlinks panel** at the bottom of every doc/note: "Linked from" list, computed by scanning `documents.content` and `notes.content` for `data-mention-id="<this-id>"`. Cached per-entity in a small `entity_backlinks` materialized view or computed live with an indexed text search.
- No embedded database views (per your call).

DB: add `cover_url TEXT`, `icon TEXT` to `documents` and `notes`. Add a `backlinks` lookup function or live query.

---

## Phase 3 (last plan): Home intranet redesign

Keep the existing widget customizer, but ship a new **default intranet layout** with:
- **Hero banner** — workspace logo, name, current company focus / quarterly theme, rotating pinned announcement.
- **Pinned announcements strip** — the most prominent block.
- **AI Companion entry tile** (preserved).
- **Tasks widget** (preserved — your priorities).
- **Reminders widget** (preserved).
- **Favorite docs** — new widget; user can star docs/notes; star table `doc_favorites`.
- **Departments grid** — tiles linking to each department hub, with a 1-line "what they're shipping" pulled from latest project.
- **Forms launcher** — quick-submit tiles for active form templates.
- **People strip** — new this week, birthdays/anniversaries, who's online.
- **Kudos pulse** — recent kudos rotating.

DB: `doc_favorites` table.

---

## What I'll build in this turn

Only Phase 1 (Mention Peek System). Phases 2 & 3 will be planned & built after you confirm Phase 1 feels right.

