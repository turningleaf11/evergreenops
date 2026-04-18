

## Plan: Lock down CEO surfaces, fix mentions, Markets workspace, Gmail label hierarchy

### 1. Lock down all CEO/admin surfaces to Primary Admin only

Currently `isAdmin` (any admin) gates these. Switch to `isPrimaryAdmin` for CEO-only surfaces:

- `src/pages/CeoDashboard.tsx` — vision edit buttons
- `src/pages/VisionPage.tsx` — vision edit buttons
- `src/components/CeoBriefing.tsx` — KPI/CRM config gear
- Any Strategy creator / Decision Log / DelegationBoard / MorningReset edits that are CEO-personal context

Other admin areas (Settings, Departments leadership tab, Gmail integration setup, user invites) **stay on `isAdmin`** — those are workspace admin tools, not CEO-personal.

I'll audit `CeoDashboard`, `VisionPage`, `CeoBriefing`, `DelegationBoard`, `DecisionLog`, `TopPriorities`, `MorningReset`, `ScratchPad`, `StrategyItemCreator`, `UpwardProposal`, `CeoReviewFeed`, `AiTriage`, and switch their write-access checks to `isPrimaryAdmin`.

### 2. Fix @mention click → still opens new page

Two root causes:

**a) PostCard renders `{post.content}` as plain text** — mentions written through the new RichTextEditor are stored as HTML but rendered raw. So either you see escaped HTML or a real `<a>` that the browser navigates normally.
- Fix: render post content with `dangerouslySetInnerHTML` (sanitized) so mention chips render as actual elements our handler can intercept.
- Add the same to `AnnouncementCard` and `ReplyThread`.

**b) Mention `<a href="/notes/x">` still triggers browser nav inside Lovable's iframe preview** before our React Router handler swallows it (some clicks bubble too late).
- Fix in `MentionExtension.renderHTML`: render as `<span role="button" data-type="mention" data-url="/...">` instead of `<a href>`. No href → no native navigation possible. The global `MentionClickHandler` already reads `data-url` and routes via React Router.
- Update `MentionClickHandler` to keep `data-url` as the source of truth and remove the http-skip (we now control everything).

### 3. Markets workspace (replace Market Research)

Restructure `MarketResearchPage`:

**Schema (migration):**
- Add `markets` table: `id, workspace_id, name, location, strategy, notes_html, criteria, links jsonb, created_by, created_at, updated_at`
- Repoint `market_research` to a child of a market: add `market_id uuid references markets(id) on delete cascade` and `created_by` (already there). Multiple analyses per market over time.
- RLS: workspace-scoped read/write.

**UI:**
- Page header: **"Markets"** with `+ Add Market` button
- Grid of **market cards** (name, location, strategy chip, last-analyzed date)
- Click a card → **Market Workspace** sheet/page with tabs:
  - **Overview** — name, location, strategy, criteria, inline RichTextEditor for free-form notes, links list (add/remove URL + label)
  - **AI Analysis** — "Run new analysis" button (uses existing `market-research` edge function), shows latest analysis inline + "View past analyses" accordion (was the "Past Analyses" sidebar)
  - **Files** (optional, hooks into existing files bucket)
- Update edge function to accept `marketId` and persist analysis under that market.

### 4. Gmail labels — preserve nested grouping

Gmail labels use `/` as a hierarchy separator (e.g. `Team Emails/MTorres`). Right now `gmail-list-labels` returns flat list and `InboxPage` renders them flat in alphabetical chaos.

**Fixes:**
- `gmail-list-labels`: also return Gmail's `color` (`color.backgroundColor`) and parse name into `path: string[]` so the UI can render groups.
- `InboxPage` "Gmail labels" sidebar: render as a **collapsible tree** grouped by `/`-separated path. e.g.
  ```
  ▾ Team Emails  
      MTorres  
      Autumn  
      Ramon  
  ▾ Triggers  
      PushLead  
      Send to Acq  
  Deals  
  Dispo
  ```
- Sort with parents before children, alphabetical within siblings.
- Keep the existing color dot if Gmail returns one; otherwise use the neutral tag icon.

### 5. Files modified

- **Schema**: new migration for `markets` + `market_research.market_id`
- **Edge functions**: `market-research/index.ts` (accept marketId), `gmail-list-labels/index.ts` (return color + path)
- **Pages**: `MarketResearchPage.tsx` (rewrite as Markets), `CeoDashboard.tsx`, `VisionPage.tsx`, `InboxPage.tsx` (label tree)
- **Components**: `MentionClickHandler.tsx`, `extensions/MentionExtension.tsx`, `feed/PostCard.tsx`, `feed/AnnouncementCard.tsx`, `feed/ReplyThread.tsx`, `CeoBriefing.tsx`, plus `isAdmin → isPrimaryAdmin` audit across CEO components
- **New**: `src/components/markets/MarketWorkspace.tsx`, `src/components/markets/MarketCard.tsx`, `src/components/markets/AddMarketDialog.tsx`

### 6. Out of scope this round
- Renaming the route `/market-research` → kept (sidebar label updates to "Markets")
- File uploads inside Market workspace — stub the tab, wire later if you want

