# OpsHQ — Product Fit Review

**Date:** 2026-08-14
**Question:** Given the new business plan, are the things on the OpsHQ sidebar what
Autumn actually needs to operate and run the business?

**Short answer:** Roughly a third of it. OpsHQ was built as a general-purpose
company OS (Notion + Asana + Slack + CRM in one app). The business it now has to
run is a single, specific machine — source, screen, underwrite, offer, assign —
and the app has no object for the four most important nouns in that machine:
**submission, underwrite, offer, assignment.**

This is not a design problem. Every surface below is well built. It is a
*coverage* problem: the app is thickest where another system already owns the
work, and empty where the business plan says the bottleneck is.

---

## 1. What the business plan actually requires

From the confirmed business model (memory `business_model`, 2026-08-11) —

- **One business.** All acquisitions under Evergreen Home Group, LLC.
- **Four ways in:** DTA (agent), DTB (broker), DTW (wholesaler), DTS (seller).
- **One machine in the middle:** screen against buy box → underwrite → offer →
  under contract.
- **Three destinations:** Fix & Flip LLC, Buy & Hold portfolio, or assigned out.
- **The money mechanic:** every deal EHG acquires is *assigned* to whichever
  entity it belongs in, and that assignment carries a **fee**. That fee is how
  the acquisition team gets paid — on every deal, regardless of destination.
- **The headline number:** 10 offers/week → 1–2 accepted. That implies roughly
  30–50 underwrites/week, which is the stated bottleneck.
- **Per-person targets:** 10 new relationships/week on each of DTA/DTB/DTW;
  3 appointments/week on DTS.
- **Minimum viable Deal Finder toolkit** (Martin's case): a buy box link and
  nothing else.

So the operating question for every sidebar item is simply: *does this move a
property from a channel into an offer, or tell me why it didn't?*

---

## 2. The evidence — what is actually being used

Row counts and last-write dates from the OpsHQ Supabase project
(`dsxrekabnwvarnroanny`), read 2026-08-14. Write recency is the more honest
signal than row count — it separates "seeded once" from "in use."

### Live (written within the last week)

| Surface | Evidence |
|---|---|
| CEO dashboard / briefings | `daily_briefings` 113 rows, **last write today** |
| GHL call sync | `orbit_call_events` 10,734 rows, **last write yesterday** |
| AI Hub / agent fleet | `agent_tasks` 27, `memories` 63, `ai_logs` 45 — all active |
| Buy box | `buy_box_criteria` 28 rows, `rule_type` screen/pricing split |

### Warm (weeks old, real content)

| Surface | Evidence |
|---|---|
| Execution Hub | `tasks` 23 (Aug 8), `projects` 18 (Jul 23), `goals` 7 |
| Scorecard | `scorecard_metrics` 64 (**32 inactive**), `scorecard_entries` 166 (Aug 7) |
| Process Map | `process_buckets` 55, `process_edges` 41 (Jun 15) |
| Business Plans | 3 plans; the Fix & Flip Co V2 doc is genuinely filled in |
| Wiki | `documents` 34 (Jul 17) |
| Dispo | `dispo_buyers` 401 (Jul 14) — a real asset, and **not on the sidebar** |

### Cold or empty

| Surface | Evidence |
|---|---|
| Deals / CRM | `crm_transactions` 2, `deals` 2, `leads` 1, `contacts` 1 |
| Feed | `posts` 0, `announcements` 0, `polls` 0, `kudos` 2 |
| Sync | `sync_thread_messages` 3, last write **May 16** |
| Training | `training_modules` 2, last write **May 12** |
| Meetings | `meetings` 0 (`meeting_agenda_items` 37, stale since June) |
| Whiteboards | 0 |
| Lists / Databases | `database_rows` 8, `database_views` 0, `database_forms` 0 |
| Decisions | `decision_log` 0 |
| **Underwriting** | **`underwriting_runs` 0 — despite Cash completing real screens** |

---

## 3. The three buckets

### A. Load-bearing — OpsHQ is the only home for these. Keep and invest.

- **CEO dashboard + daily briefings.** By write recency this is the single most
  used surface in the app. It is the one place the whole business is legible.
- **Buy box.** Genuinely proprietary. Feeds Cash, feeds
  `buybox.evergreenreventures.com`, and is the *entire* toolkit of an outside
  Deal Finder. The `rule_type` screen/pricing split is exactly right.
- **AI Hub + agent fleet** (`agent_tasks`, `memories`, `ai_logs`). This is the
  coordination layer for Albus/Cash/Dex/Ema. Nothing else does this.
- **Scorecard** — load-bearing *in principle*, but see the caveat below.
- **Process Map.** Static since June, but that is correct for a reference asset.
  It is the map of the machine.
- **Execution Hub + Business Plans.** The strategy layer. Modest usage, but no
  competitor system, and the Fix & Flip V2 plan doc shows it is being used the
  way it was designed.

**Scorecard caveat.** 32 of 64 metrics are inactive, the last entry is Aug 7,
and the active ones point at `main:` and `listing:` GHL pipelines — the
**DTS/wholesale era**. Nothing measures 10 offers/week, nothing measures 10
relationships per person per channel, nothing measures underwrites. The
scorecard is measuring the old strategy. This is the highest-leverage fix in the
whole app, and it is a re-cut, not a rebuild.

### B. Structurally displaced — another system already won. Stop investing.

These are not bad features. They lost to an incumbent that owns the workflow
end-to-end, and a second, emptier copy is worse than none.

| Sidebar item | Who actually owns it |
|---|---|
| Deals / CRM | **GHL** — pipelines, contacts, opportunities, ~17k contacts |
| Feed | **Discord** — community and team comms (already noted in memory) |
| Sync | **Discord** |
| Training | **GHL Courses** — Orbit foundation course, per-track training, NDA/ICA |
| Meetings, Whiteboards, Lists, Forms | Generic-OS filler — already hidden behind `isPrimaryAdmin` |
| Time Clock, Content Studio, AI Workshop, Market Research | Add-on surface for a *product*, not for running EHG |

Four of these are already fenced behind `isPrimaryAdmin` in `AppSidebar.tsx`
with a comment saying "still being developed." Worth being honest that the
condition is not really *developing* — it is *parked*. Say so in the code, or
remove them.

### C. The gap — what the plan needs and the sidebar does not have

This is the real finding. **The four central nouns of the business have no home
in the app.**

1. **Underwriting queue.** The plan names underwriting as *the bottleneck*:
   30–50/week to produce 10 offers. There is no sidebar item for it.
   `underwriting_runs` has **zero rows** even though Cash has completed real
   screens — Cash's own skill file says this write is mandatory. And the actual
   underwriting tools (Napkin, ARVA) run on **Lovable-owned** Supabase projects.
   The most important process in the business is the one with no surface, no
   data, and no infrastructure ownership.

2. **Offers.** The headline KPI is 10 offers/week. There is no offer object
   anywhere in the schema. You cannot count what you do not store — the
   company's single most important number is currently untrackable in the tool
   built to track the company.

3. **Deal Finder submission intake.** Four channels feeding N contractors, whose
   minimum toolkit is "a buy box link." Where does a submitted property land?
   Today: nowhere in OpsHQ. This is the front door of the machine.

4. **Assignment + destination + fee.** Every deal gets assigned to F&F, Buy &
   Hold, or a third party, and the fee on that assignment is *how the
   acquisition team gets paid*. Nothing in the app records the destination or
   the fee. The core money mechanic of the business plan is invisible.

Two more, smaller:

5. **Per-person channel activity.** 10 relationships/week/person on DTA/DTB/DTW
   is the top-of-funnel target. `orbit_call_events` (10.7k, live) covers calls,
   but no metric rolls it up per person per channel.

6. **Team Hub** — in flight and paused mid-build (see the `team_hub_security`
   handoff). This is the actual daily surface for finders and leads, and it
   should be a first-class sidebar destination, not a separate app bolted onto
   the same auth pool.

---

## 4. Proposed sidebar

Organised around the machine rather than around software categories.

```
Home
CEO
Scorecard                    ← re-cut against the new plan's numbers

THE MACHINE
  Submissions                ← NEW. front door, all four channels
  Buy Box                    ← promote out of Settings/agent-only
  Underwriting               ← NEW. the bottleneck, made visible
  Offers                     ← NEW. the headline KPI, as an object
  Deals                      ← repoint at contract → assignment → fee
  Dispo                      ← surface the 401 buyers already in the DB

COMPANY
  Business Plans
  Execution Hub
  Process Map
  Wiki
  Activity
  People
  Team Hub                   ← finish the paused build

AI
  AI Hub
```

Retired or parked: Feed, Sync, Training, Meetings, Whiteboards, Lists, Forms,
CRM contacts/leads, Time Clock, Content Studio, AI Workshop, Market Research.

Note that this is mostly **subtraction plus four new nouns**. Almost nothing
well-built gets thrown away; the generic company-OS layer gets stood down
because GHL and Discord already won those jobs.

---

## 5. The one real fork in the road

The recommendation above assumes **OpsHQ is an internal tool for Evergreen Home
Group.** If that is the intent, cut hard toward the machine.

But the codebase is also built like a **multi-tenant SaaS product**:
`workspace_addons`, `addon_packs`, `page_grants`, configurable `ceoPageName` and
`deptLabel`, a landing page, a signup page. Under *that* reading, the generic
surfaces (Feed, Meetings, Lists, Training, Time Clock) are not dead weight —
they are the product, and Evergreen is customer zero.

These two readings lead to opposite decisions on roughly a third of the sidebar,
and the decision is Autumn's, not something to infer from row counts. Worth
naming explicitly before any cutting happens.

Either way, items C1–C4 are needed. An internal tool needs them to run the
business; a product needs them because vertical real-estate acquisition
workflow is the only thing that would make OpsHQ worth buying over Notion.

---

## 6. Recommended order

1. **Re-cut the scorecard** against the new plan (offers/week, underwrites/week,
   relationships per person per channel, appointments on DTS). Cheapest change,
   biggest immediate clarity gain. Blocked on the pending GHL Contact Audit task
   so targets sit on real data.
2. **Fix the `underwriting_runs` write.** Cash is completing real screens and
   logging nothing. Albus-side fix, not fixable from a Claude Code session.
   Until this works, every downstream idea (standings, gamification, the
   underwriting queue) reads from an empty table.
3. **Build Submissions → Underwriting → Offers** as one connected surface. This
   is the machine; today it exists only as a diagram on the Process Map.
4. **Add assignment destination + fee to the deal record.** The money mechanic.
5. **Finish Team Hub** and retire the parked generic surfaces from the sidebar.
