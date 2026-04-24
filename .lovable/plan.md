# Prettify Gmail system labels in the inbox sidebar

Stop hiding `CATEGORY_*`, `*_STAR`, and `IMPORTANT`. Show them with proper names, real icons, and the right colors so they're useful (favorites, categories) instead of cryptic.

## What changes in the sidebar

Replace the bullet dot with a meaningful icon for system labels:

| Gmail ID | Display name | Icon | Color |
|---|---|---|---|
| `YELLOW_STAR` | Yellow star | filled Star | yellow (#facc15) |
| `RED_STAR` | Red star | filled Star | red (#ef4444) |
| `ORANGE_STAR` / `BLUE_STAR` / `GREEN_STAR` / `PURPLE_STAR` | Orange/Blue/… star | filled Star | matching hue |
| `YELLOW_BUBBLE` / `RED_BUBBLE` / `BLUE_BUBBLE` / `GREEN_BUBBLE` / `PURPLE_BUBBLE` / `ORANGE_BUBBLE` | … bubble | filled Circle | matching hue |
| `RED_BANG` / `YELLOW_BANG` / `PURPLE_QUESTION` | … flag | AlertCircle / HelpCircle | matching hue |
| `BLUE_INFO` | Info | Info | blue |
| `GREEN_CHECK` | Check | CheckCircle | green |
| `PURPLE_GUILLEMET` | Forwarded | ChevronsRight | purple |
| `IMPORTANT` | Important | Tag (filled) | amber |
| `CATEGORY_PERSONAL` | Personal | User | indigo |
| `CATEGORY_SOCIAL` | Social | Users | blue |
| `CATEGORY_PROMOTIONS` | Promotions | Tag | green |
| `CATEGORY_UPDATES` | Updates | Bell | orange |
| `CATEGORY_FORUMS` | Forums | MessageSquare | purple |

User labels (Deal Machine, Deals, Triggers, Team Emails, etc.) are unchanged — they keep the colored bullet dot.

## Grouping

Add a small grouping pass on the client so the sidebar has clearer sections:

```text
Gmail labels
  Categories          ← collapsible, contains CATEGORY_*
  Stars & flags       ← collapsible, contains *_STAR / *_BUBBLE / IMPORTANT
  <user labels…>      ← Deal Machine, Deals, Dispo, Team Emails, Triggers
```

All groups default to collapsed (already in place for user-label hierarchies). The two new system groups also default to collapsed.

## Technical changes

1. **`supabase/functions/gmail-list-labels/index.ts`** — stop filtering out `CATEGORY_*`, `*_STAR`, `*_BUBBLE`, `IMPORTANT`, etc. Keep filtering `INBOX/SENT/DRAFT/TRASH/SPAM/STARRED/UNREAD/CHAT` (those have their own UI). Pass through `type: "system"` so the client can switch rendering. Redeploy.

2. **`src/components/inbox/gmailSystemLabels.ts`** (new) — small lookup module exporting:
   - `SYSTEM_LABEL_META: Record<string, { displayName: string; icon: LucideIcon; color: string; group: "categories" | "stars" }>`
   - Helper `getSystemLabelMeta(id)` → returns meta or `null` for non-system.

3. **`src/pages/InboxPage.tsx`** — in the Gmail labels render block:
   - Drop the client-side filter that removes these IDs.
   - Bucket labels into `categories`, `stars`, and `userGroups` before rendering.
   - For system labels, render `<Icon className="h-3.5 w-3.5" style={{ color }} />` instead of the `<span>` bullet, and use `meta.displayName` instead of `l.leaf`.
   - Render the two synthetic "Categories" and "Stars & flags" collapsible groups above the user-label groups, with the same collapse behavior already wired (`collapsedGroups`).
   - Seed both synthetic group keys into `collapsedGroups` on first label load so they default collapsed.

No DB migration. No new dependencies (Lucide icons are already used everywhere).
