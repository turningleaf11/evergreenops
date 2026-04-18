

You're asking about due date — confirming where it lives after the Overview restructure.

## Due Date Placement

Currently the project header already shows the due date inline (next to status/owner). In the new Overview layout, I'll **keep due date in the header only** (same treatment as Linked Goal) — no duplicate card on Overview.

Updated right column on Overview becomes:
1. **Team** (top right)
2. **Tasks summary** (open count + next 3 due)
3. **Files** (with upload)

Header keeps: Title · Status · Owner · **Due Date** · Linked Goal (clickable) · Discussion toggle

If due date is missing from the current header, I'll add it there as part of this work so it stays one-glance visible without taking Overview real estate.

Everything else from the prior plan stands:
1. Task click → side-peek DetailDrawer (no full page nav)
2. Back button → "Back to Projects" → `/execution?tab=projects`
3. Overview = inline Notes editor (left) + Team / Tasks / Files (right). No Linked Goal card, no Due Date card.
4. Header Linked Goal chip → opens GoalPeek
5. File upload on Files card + Files tab (Supabase `files` bucket, creates `documents` row with `project_id`)
6. App background `--background` → `#FAFAFA` (light theme)

