# Installing agent skills into OpenClaw (Albus)

OpenClaw keeps private skills as markdown files on the machine Albus runs on, at:

```
~/.openclaw/skills/<skill-name>/SKILL.md
```

Each file has YAML frontmatter (`name`, `description`) followed by the
instructions. Albus loads them at runtime when relevant.

---

## The easy way — have Albus install them

Albus has file read/write access, so you can just tell him to do it. Paste this
into your Albus chat, with the skill file contents pasted where indicated:

> Create a new skill directory at `~/.openclaw/skills/cash/` and write a file
> `SKILL.md` inside it with exactly the content below. Then confirm the file
> exists and reload your skills.
>
> ```
> <paste the full contents of cash-SKILL.md here>
> ```

Repeat for `dex`, using `dex-SKILL.md`.

Then have him clean up the ones being replaced:

> The `deal-scout` skill is now superseded by `cash`, and `codex-coder` is
> superseded by `dex`. Remove `~/.openclaw/skills/deal-scout/` and
> `~/.openclaw/skills/codex-coder/`, then list your remaining skills so I can
> confirm.

Also worth retiring: **`claude-coder`**. Despite the name it is not connected to
Claude or to Anthropic's API — it is Albus editing files itself under a persona.
The name implies an integration that does not exist, which is exactly the
confusion this whole exercise set out to remove.

---

## The manual way

If you'd rather do it yourself on the machine running OpenClaw:

```bash
mkdir -p ~/.openclaw/skills/cash
# paste cash-SKILL.md contents into ~/.openclaw/skills/cash/SKILL.md

mkdir -p ~/.openclaw/skills/dex
# paste dex-SKILL.md contents into ~/.openclaw/skills/dex/SKILL.md

rm -rf ~/.openclaw/skills/deal-scout ~/.openclaw/skills/codex-coder
```

Then restart the gateway or ask Albus to reload skills.

---

## Verifying it actually worked

Self-reports aren't enough — the whole problem with the previous six skills was
that they ran and wrote nothing. Run a real test and check the database.

**Test Cash:**

> Cash, screen this deal: 123 Main St, Hollywood FL. 2 bed / 1 bath, 1,400 sqft,
> asking $310,000, single family, needs a full rehab.

Expected: it fails the buy box on bed count (3 minimum), finds the
`conditional_adjustment` exception, and proposes pricing a bedroom conversion
rather than flatly rejecting — flagged for human confirmation.

**Test Dex:**

> Dex, draft a plan to add a `last_screened_at` timestamp column to
> `buy_box_criteria` and surface it in the AI Hub agents tab.

Expected: a task appears assigned to `dex` at status `review`, with a file-by-file
plan in `result`. It must **not** reach `approved` on its own.

**Then check the tables** — this is the part that matters:

```sql
SELECT agent_name, category, message, created_at
FROM ai_logs ORDER BY created_at DESC LIMIT 10;

SELECT title, assigned_to, status, created_at
FROM agent_tasks ORDER BY created_at DESC LIMIT 5;

SELECT property_address, tier, verdict, buy_box_result
FROM underwriting_runs ORDER BY created_at DESC LIMIT 5;
```

If those come back empty, the skill loaded but the persistence instructions
aren't being followed — which is the exact failure mode of the old skills, and
worth fixing before building anything on top.
