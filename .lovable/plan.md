
## Phase 3.1 — Magazine-Style Intranet Lobby

Replacing the current single-column widget grid with a fixed, multi-zone magazine layout. No more drag/drop customization — this becomes a curated lobby.

### Layout (1438px desktop)

```text
┌─────────────────────────────────────────────────────────────────┐
│  GREETING ROW (full width)                                      │
│  "Good afternoon, Autumn" · Thursday, April 20                  │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────┬──────────────────────────────┐
│  PULSE STRIP (2/3)               │  DAILY MOTIVATION (1/3)      │
│  4 stat tiles in a row           │  Rotating quote card,        │
│  kudos · announcements ·         │  soft gradient, refresh btn  │
│  posts · teammates               │                              │
└──────────────────────────────────┴──────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  📌 PINNED ANNOUNCEMENTS STRIP (full width, thin)               │
│  Horizontal scroll of pinned items, ~64px tall, dismissible     │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────────┬───────────────────────┬──────────────────┐
│  MAIN COLUMN (5/12)  │  CENTER (4/12)        │  RAIL (3/12)     │
│                      │                       │                  │
│  💬 Company Feed     │  ❤️ Recognition       │  👥 My Team      │
│  Composer + 4 posts  │  Recent kudos cards   │  Avatars + status│
│  "View full feed →"  │                       │                  │
│                      │  🎂 Celebrations      │  📅 This Week    │
│                      │  Birthdays/anniv      │  (small calendar │
│                      │                       │   of upcoming    │
│                      │                       │   events)        │
└──────────────────────┴───────────────────────┴──────────────────┘
```

Below `lg` breakpoint: collapses to 2 columns, then 1 on mobile. Magazine feel preserved on desktop where it matters.

### Components

**New / Modified**
1. **`PulseStrip.tsx`** — strip-only (no greeting). 4 stat tiles in a horizontal row, each tile gets a subtle tinted background (`bg-rose-500/5` etc.) matching its icon tone for color/depth.
2. **`GreetingHeader.tsx`** *(new)* — full-width band. Large greeting + date. Optional subtle gradient backdrop using workspace accent color at low opacity.
3. **`DailyMotivation.tsx`** *(new)* — rotating quote card. Curated array of ~30 leadership/work quotes hardcoded in `src/lib/motivational-quotes.ts`. Picks deterministically by day-of-year so it's stable per day. Refresh button to re-roll. Soft gradient background (uses workspace accent).
4. **`PinnedAnnouncementsStrip.tsx`** *(new)* — fetches `announcements` where `pinned = true`, last 30 days. Renders as horizontal scrollable strip of compact cards (~64px tall). Empty state hides the strip entirely.
5. **`ThisWeekWidget.tsx`** *(new)* — small mini-calendar showing the current week with dots on days that have events: birthdays, anniversaries, and pinned announcement dates. Replaces the need for a full calendar.
6. **`Index.tsx`** — rewritten to fixed magazine grid. Removes `WidgetCustomizer`, `useWidgetPreferences`, drag-and-drop logic.
7. **`AppSidebar.tsx`** — remove the "Customize home" entry point if present.

**Removed**
- `WidgetCustomizer.tsx` (component file kept but unimported, can be deleted)
- `useWidgetPreferences.ts` (kept, unimported)
- `widgetRegistry.ts` (kept, unimported)
- `FeedCarousel.tsx` (replaced by `InlineFeed`, already done)

### Visual depth treatment

Inspired by your three reference images (Workvivo / Wix-intranet style):
- **Card elevation**: `border border-border/60 bg-card shadow-sm` baseline; hero cards get `shadow-md`
- **Tinted card backgrounds**: Recognition gets `bg-rose-500/[0.03]`, Motivation gets workspace accent gradient, Celebrations gets `bg-pink-500/[0.03]` — gives the page color zones without being loud
- **Section spacing**: `gap-5` between cards, `gap-6` between row zones
- **Rounded corners**: `rounded-2xl` on hero cards, `rounded-xl` on rail cards (varied sizes adds rhythm)
- **Greeting band**: subtle `bg-gradient-to-r from-accent/5 via-transparent to-transparent` for warmth without being heavy

### Daily Motivation content

Hardcoded curated list in `src/lib/motivational-quotes.ts` — ~30 quotes mixing leadership, focus, real estate / entrepreneurship themes (matches Evergreen's vibe). Format: `{ quote: string, author: string }`. Selection: `quotes[dayOfYear % quotes.length]` for stable daily rotation. Refresh button picks random for the session.

### What stays the same

- Onboarding banner at the very top (above greeting) — keep as-is
- Sidebar navigation grouping (People & Culture / Work) from prior phase
- All widget data sources, Supabase queries unchanged
- Inline feed composer + post rendering unchanged

### Out of scope

- Department hub redesign (still deferred)
- Cover photo / hero image
- Calendar event entity (mini-calendar uses existing birthday + announcement data only)
- Quote authoring UI — just the curated list

### Files touched

```text
NEW    src/components/home/GreetingHeader.tsx
NEW    src/components/home/DailyMotivation.tsx
NEW    src/components/home/PinnedAnnouncementsStrip.tsx
NEW    src/components/home/ThisWeekWidget.tsx
NEW    src/lib/motivational-quotes.ts
EDIT   src/components/home/PulseStrip.tsx       (strip only, no greeting)
EDIT   src/pages/Index.tsx                       (magazine grid, no customizer)
EDIT   src/components/AppSidebar.tsx             (remove customize entry if any)
```

No DB migration needed.
