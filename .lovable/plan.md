

# CEO Strategy Command Center + AI Strategy Companion

## Context
This is for **Evergreen Real Estate Ventures**. The CEO dashboard must be a strategy and thinking tool — not an ops dashboard. Two teams: Wholesale Acquisitions (residential 1-4 unit) and Portfolio Acquisitions (multifamily 5+, business, JV deals). Every widget must support a real executive decision.

## What Gets Built

### 1. CEO Context Memory (`src/lib/ceo-context.ts`)
A persistent state structure (useState + localStorage for now, with clear hooks for future API/DB):

```text
CEOContext {
  currentObjective: string
  currentConstraints: string[]
  topPriorities: { id, text, status }[]     // max 3-5
  recentDecisions: { id, text, date, outcome? }[]
  strategicTensions: { id, tension, sideA, sideB }[]
  pipelineSnapshot: { wholesaleDeals, portfolioDeals, closingThisMonth }
}
```

All editable inline. This becomes the AI's context window.

### 2. CEO Dashboard Page (`src/pages/CeoDashboard.tsx`, route `/ceo`)
Replaces the current Index as the admin's home. Calm, premium, high-signal layout with these modules only:

- **Current Objective** — Single editable line. The one thing that matters right now. Always visible at top.
- **CEO Briefing** — A structured card summarizing: current objective, pipeline reality (pulled from databases), top risks, top leverage opportunities, decisions needing attention. Manually curated + AI-generated summary placeholder.
- **Top Priorities** — 3-5 editable priority items with status (active/blocked/done). Not a task list — strategic priorities.
- **Recent Decisions Log** — Short journal of decisions made, with optional outcome notes. Reverse chronological.
- **Strategic Tensions** — Named tensions the CEO is holding (e.g., "Speed vs. Quality on deal flow"). Two sides, no resolution required — just awareness.
- **Morning Reset** — A collapsible section: "What matters today", "What does NOT deserve attention today", "One win for the day". Editable daily.

No vanity metrics. No activity feeds. No generic cards.

### 3. AI Strategy Chat Sidebar (`src/components/CeoAiChat.tsx`)
A slide-out panel (Sheet) triggered from the dashboard. The AI:

- Receives full CEOContext + workspace data as system prompt context
- Every response is structured into: **Actual Problem → Root Cause → Options → Recommended Path → Next Actions**
- Proactive behaviors (initially mocked, with clear integration points for Lovable AI):
  - **Morning briefing** auto-generated when dashboard opens
  - **Nudges** surfaced as subtle cards when priorities are stale or tensions unresolved
  - **Suggested actions** like "Schedule check-in with Portfolio team — no deal updates in 5 days"
- Uses Lovable AI (edge function) for real responses, with structured prompt engineering to enforce the response format

### 4. Morning Reset Flow (`src/components/MorningReset.tsx`)
A focused component (possibly modal or top-of-dashboard card):
- "What matters today" — free text
- "What does NOT deserve attention" — free text
- "One win for the day" — single line
- Saved per day in localStorage, shown on dashboard

### 5. UI Treatment
- Calm, premium feel — more whitespace, muted borders, subtle shadows
- Serif or semi-bold headings for gravitas
- Muted color palette (slate/stone tones, no bright accent overuse)
- Typography-driven hierarchy, not color-driven

### 6. Sidebar + Routing Updates
- Add "Strategy" or "Command Center" link in sidebar (admin only, with a crown/compass icon)
- Route `/ceo` in App.tsx
- Keep existing Index (`/`) as the team-level home for non-admin users

## New Files
- `src/pages/CeoDashboard.tsx` — the main dashboard
- `src/lib/ceo-context.ts` — context data model + localStorage persistence + React context
- `src/components/CeoAiChat.tsx` — AI strategy chat sidebar
- `src/components/MorningReset.tsx` — morning reset component
- `src/components/CeoBriefing.tsx` — structured briefing card
- `src/components/StrategicTensions.tsx` — tensions tracker
- `src/components/DecisionLog.tsx` — decisions journal
- `src/components/TopPriorities.tsx` — priority items

## Modified Files
- `src/App.tsx` — add `/ceo` route
- `src/components/AppSidebar.tsx` — add Strategy link (admin only)
- `src/pages/Index.tsx` — keep as team home, no changes needed

## Build Order
1. CEO context data model + localStorage persistence
2. Dashboard page with all modules (static/editable, no AI yet)
3. Morning Reset component
4. AI Strategy Chat sidebar with Lovable AI edge function
5. Sidebar + routing
6. UI polish pass

## AI Integration Points (commented in code)
- `ceo-context.ts`: `// TODO: Replace localStorage with Supabase persistence`
- `CeoAiChat.tsx`: `// AI edge function call here — passes CEOContext as system prompt`
- `CeoBriefing.tsx`: `// TODO: Pull pipeline data from databases, generate AI summary`

