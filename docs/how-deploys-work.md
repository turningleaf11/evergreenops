# Deploys — who does what

Autumn does not manage branches, pull requests, merge order, or deploy
failures. Claude does. This page exists so she can see how it works if she
wants to, not so she has to.

**The entire interface is one question and one answer.**

> Claude: "Marquetta's database tables are ready — new content tables plus a fix
> to the deploy pipeline. Nothing visible in the app changes yet. Merge to main?"
>
> Autumn: "yes"

Everything after that is Claude's job, including watching the deploy and fixing
it if it breaks.

---

## What Claude owns, without asking

- Creating and naming branches
- Opening pull requests, if one is warranted
- Deciding merge order when more than one session is in flight, and coordinating
  it with the other session directly
- Running the merge once approved
- Watching the deploy to green
- Diagnosing and fixing a red deploy
- Telling Autumn, in plain terms, if something needs her

Claude does **not** ask Autumn about branch names, merge order, PR mechanics, or
anything requiring GitHub knowledge. If two sessions need sequencing, the
sessions sort it out between themselves and Autumn hears the outcome, not the
negotiation.

## What Autumn owns

One decision: **should this go live now?**

That is a business call — is the work right, is this the moment — and it stays
hers. "Push to main", "ship it", "yes" all mean the same thing: go.

---

## What actually happens on a merge

Work happens on a branch, which is a private copy that affects nothing. Merging
copies it into `main`, the official version, and that is the moment it becomes
real.

When something lands on `main` that touches `supabase/**`, a robot runs
automatically and:

1. Checks the database's record of what it has run against the repo
2. Applies any new database migrations
3. Redeploys the edge functions (daily-briefing, ceo-triage, cadences-generate,
   agent-gateway, agent-gateway-mcp)

Nothing else is automatic. Installing an agent skill into Albus's container,
rotating a credential, moving files into Drive — those are still done by hand,
and Claude has to say so at merge time rather than letting them go quiet.

---

## Why migrations get extra care

Most code changes behavior and can be undone by shipping a correction. A
**migration** changes the database's structure — adds a table, adds a column —
and undoing one is genuinely hard once real data is sitting in it. Accounting
records make that sharper than usual.

The database keeps a ledger of every migration it has run. The repo and the
ledger must agree. Three states are possible:

| State | Meaning | Result |
|---|---|---|
| In both | Already applied | Fine |
| Repo only | Written, not yet run — *pending* | The robot applies it. Normal. |
| Database only | Production ran something the repo lacks | **Drift.** Deploy stops. |

Drift means the live database has structure nobody can reproduce from the code.
It is caused by applying a migration directly instead of merging — which is
tempting because it works instantly, and which Supabase's `apply_migration` makes
worse by assigning its own timestamp and not saying which one it picked.

**The rule for every Claude session: migrations reach production by merging,
never by hand.** If it happens anyway, read the real version back from
`supabase_migrations.schema_migrations` and rename the file to match immediately.

---

## If a deploy goes red

Claude's problem, not Autumn's. The expected behavior is: diagnose it, fix it,
push the fix, confirm green, and only then report — mentioning it at all only
because a red deploy means the work is not actually live yet.

Claude should not stack another merge on top of a red deploy, and should not
report work as shipped while the deploy is failing.

---

## Vocabulary, if it ever comes up

| Term | Meaning |
|---|---|
| Branch | A private copy of the code. Affects nothing. |
| `main` | The official copy. What the business runs. |
| Merge | Moving branch work into `main`. The go-live moment. |
| PR (pull request) | A review page with a merge button. |
| CI / Actions / "the deploy" | The robot that ships when `main` changes. |
| Migration | A file that changes the database's shape. |
| Drift | Production and the repo disagree. Stop and fix. |
