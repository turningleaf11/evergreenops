

## Home Layout — Refined Plan v2

### Changes from prior plan

**1. Reorder left column** — Reminders above Tasks
- Reminders is short + time-sensitive → top of left column
- My Tasks below as the main work surface

**2. Widen left column** — grid `3/5/4` → `4/5/3`
- Tasks gets ~440px instead of ~340px
- Right rail tightens to 3/12 (compact widgets only)

**3. Render actual posts in Recognition feed item** (per screenshot)
- Currently the kudos shows as raw HTML (`<p>...</p>`) wrapped in italic quotes — looks broken
- Strip HTML tags, render plain text, drop the italic-quotes treatment
- Use the same compact post style as SlimFeed: avatar, name, action verb, message, timestamp — no HTML leakage

**4. SlimFeed stays slim, no width changes**
- It's already in the 5/12 center column which is the right width
- Just confirm post rows stay compact (no full-width media expansion in the home widget)

### New layout

```text
Left (4/12)        Center (5/12)       Right (3/12)
─────────────      ──────────────      ─────────────
Reminders          Recognition         This Week
My Tasks           Company Feed        My Team
Recent Docs                            Celebrations
```

### Files to edit

```text
EDIT  src/pages/Index.tsx
      - Grid spans: 3/5/4 → 4/5/3
      - Left col order: Reminders, MyTasks, RecentDocs
      - Right col order: ThisWeek, MyTeam, Birthdays

EDIT  src/components/home/RecognitionWidget.tsx
      - Strip HTML from kudos message before render
      - Remove italic + surrounding quotes
      - Match SlimFeed row visual style for consistency
```

No new components, no DB changes, no breakpoint changes.

