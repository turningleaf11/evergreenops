# How code gets from a Claude session to production

Written for Autumn. No prior knowledge assumed. If you only read one section,
read **The four rules**.

---

## The short version

Work happens on a **branch** — a private copy of the codebase. Nothing on a
branch affects the live app, no matter how finished it looks. Work becomes real
when the branch is **merged into `main`**, which is the one official copy.

Merging to `main` is the moment something goes live. That is the decision that
belongs to you. Everything before it is reversible; everything after it is
running.

```
Claude session  ──►  branch  ──►  you approve  ──►  main  ──►  robot deploys it
                     (safe)        (the moment)      (live)
```

---

## The pieces, in plain language

**Branch.** A named workspace, e.g. `claude/content-strategy-automation-ir5d5e`.
Each Claude session gets its own. Two sessions on two branches cannot break each
other's work. A branch can be abandoned with no consequences.

**`main`.** The official version. What `main` says is what the business runs.

**Merge.** Copying a branch's changes into `main`. This is the go-live step.

**Pull request (PR).** A page on GitHub showing what a branch would change, with
a button to merge it. It's the review step before the go-live step.

**CI / "the workflow" / "the deploy".** A robot that watches `main`. When
something lands there, it does the work of putting it live. It is not
intelligent — it follows a script and stops if the script says stop.

**Migration.** A file that changes the *database's shape* — adds a table, adds a
column. Ordinary code changes behavior; a migration changes structure. This is
why they get special treatment below.

---

## What happens automatically, and what doesn't

When something merges into `main` and touches `supabase/**`, the Deploy Supabase
workflow runs on its own and:

1. Checks that the database's record of what it has run matches the repo
2. Applies any new migrations
3. Redeploys the edge functions (daily-briefing, ceo-triage, cadences-generate,
   agent-gateway, agent-gateway-mcp)

**Nothing else is automatic.** Installing an agent skill into Albus's container,
rotating a credential, moving a video into Drive — those are still done by hand
and nobody is reminded to do them.

---

## Why migrations are the fussy part

The database keeps its own list of every migration it has already run, called
the ledger. A migration file is named with a timestamp — `20260905180000_…` —
and that timestamp is its ID in the ledger.

The rule the robot enforces: **the repo and the ledger must agree.** Comparing
them gives three possible states.

| State | What it means | What happens |
|---|---|---|
| In both | Already applied | Nothing. Fine. |
| **In the repo only** | Written but not run yet — a *pending* migration | The robot applies it. This is normal. |
| **In the database only** | Production ran something the repo doesn't have | **Stop.** The repo is no longer the truth. |

That last row is the dangerous one. It means the live database has structure
nobody can reproduce — you couldn't rebuild it from the code, and the next
person to touch it is working blind.

**How that happens (this is the trap):** a session can apply a migration
directly to the database instead of going through `main`. It's tempting because
it works instantly. But the Supabase tool that does it *assigns its own
timestamp* and doesn't say which one it picked — so the file says one ID, the
ledger says another, and now they disagree in two ways at once. Both sessions
hit this today.

---

## The four rules

**1. Migrations reach production by merging, never by hand.**
Applying directly is the single thing that causes the mess above. If it ever
happens anyway, read the real version back immediately and rename the file to
match:

```sql
select version, name from supabase_migrations.schema_migrations
 order by version desc limit 5;
```

**2. If a change fixes the deploy process itself, it merges together with the
work that needs it.** A fix sitting on a branch protects nothing. This is the
one that caught us: the workflow couldn't deploy new migrations at all, so the
fix and the first migration to need it had to be in the same merge. Merge order
alone would not have solved it.

**3. Merge order only matters when one branch depends on another.**
Most of the time it doesn't matter at all — two sessions touching different
files can merge in either order. It matters when one branch's work needs the
other's to already be there. **When it matters, whichever Claude session raised
it will tell you.** You are not expected to work this out yourself.

**4. If the deploy goes red, don't merge more on top.**
A failed deploy is the robot refusing to make things worse. Ask the session that
merged what it means. Stacking another merge on a red deploy turns one problem
into two tangled ones.

---

## Your actual checklist

When a session says work is ready:

1. **Ask what it changes** — one line, in plain terms.
2. **Ask what needs to be true first.** ("Does anything have to merge before
   this?") If nothing, order doesn't matter.
3. **Merge it.**
4. **Check the deploy went green.** GitHub → Actions tab → the run at the top.
   Green tick: done. Red X: rule 4.
5. **Ask if anything manual is left.** Skill installs, credentials, Drive
   uploads — these do not happen on their own.

When two sessions are running at once:

- Ask each one whether its work depends on the other's. Usually the answer is
  no, and you merge them in whatever order you like.
- If either says yes, merge in the order they give you.
- After the first merge, tell the second session it landed, so it can pull the
  changes in before continuing.

---

## Questions worth asking a session, any time

- "Is this on a branch or is it live?"
- "What breaks if we don't merge this today?"
- "Has this been tested, or only written?"
- "Is there anything I have to do by hand after merging?"

A good answer to the third one names what was actually run. "It typechecks" and
"I executed it against a scratch database and here are the results" are very
different claims, and you're entitled to the second one for anything touching
the database.

---

## Vocabulary, one line each

| Term | Meaning |
|---|---|
| Branch | A private copy of the code. Safe. |
| `main` | The official copy. Live. |
| Merge | Moving branch work into `main`. The go-live moment. |
| PR (pull request) | The review page with the merge button. |
| Commit | One saved chunk of work, with a message explaining it. |
| CI / workflow / Actions | The robot that deploys when `main` changes. |
| Migration | A file that changes the database's shape. |
| Ledger (`schema_migrations`) | The database's list of migrations it has run. |
| Pending | Written, committed, not yet applied. Normal. |
| Drift | Production and the repo disagree. Not normal. Stop. |
| Rollback | Undoing a deploy. Easy for code, hard for migrations — which is why migrations get this much care. |
