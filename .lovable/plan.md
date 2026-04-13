

# Strategy Flow System: CEO → Leadership → Operations

## Overview
Build a structured strategy cascade system where strategy items flow from the CEO dashboard down to department leaders, who must acknowledge, translate, and execute — with structured upward feedback flowing back to the CEO.

## What Gets Built

### 1. Strategy Items Data Model (`src/lib/strategy-flow.ts`)
A new React context + localStorage persistence for strategy items that flow through the org.

```text
StrategyItem {
  id: string
  type: "objective" | "constraint" | "decision"
  title: string
  description: string
  createdBy: string                    // user ID
  assignedDepartments: string[]        // department IDs
  status: "new" | "acknowledged" | "translated" | "in_execution" | "resolved"
  createdAt: string
  updatedAt: string
  // Leadership responses (one per department)
  responses: LeadershipResponse[]
}

LeadershipResponse {
  id: string
  strategyItemId: string
  departmentId: string
  responderId: string
  type: "accept" | "refine" | "challenge"
  // Structured fields
  groundTruth: string       // "what I'm seeing on the ground"
  analysis: string          // "what I believe is actually happening"
  recommendation: string    // "recommended change or approach"
  expectedImpact: string    // "expected impact"
  createdAt: string
}

TranslationBlock {
  id: string
  strategyItemId: string
  departmentId: string
  meaning: string           // "what this means for our department"
  immediateChanges: string  // "what changes immediately"
  priorities: string[]      // top 1-2 priorities
  actions: string[]         // actions to implement
  createdAt: string
}

UpwardProposal {
  id: string
  type: "strategy_change" | "escalate_constraint" | "request_decision" | "flag_misalignment"
  departmentId: string
  createdBy: string
  title: string
  reasoning: string
  recommendation: string
  status: "pending" | "accepted" | "rejected" | "clarification_needed"
  ceoResponse?: string
  createdAt: string
}
```

### 2. CEO Dashboard Additions (`src/pages/CeoDashboard.tsx`)

Add two new sections to the existing CEO dashboard:

- **Strategy Items Manager** — Create/edit strategy items (objective, constraint, decision), assign to departments, track status across the org
- **CEO Review Feed** — Shows leadership proposals, challenges, and escalations with structured reasoning. CEO can accept, reject, or request clarification. Accepted changes update the Strategy Command Center.

### 3. Leadership Dashboard (`src/pages/LeadershipDashboard.tsx`, route `/leadership/:deptId`)

A new page for department leads with two modes:

**Execution Mode (default):**
- **Strategy Feed** — Incoming strategy items from CEO, filtered by department. Each shows status, context, and a "Respond to Strategy" action
- **Translation Block** — For each strategy item, the leader must define: what it means for their department, immediate changes, top priorities, and actions
- **Execution Snapshot** — Active projects tied to priorities (pulled from existing databases), relevant tasks, blockers

**Think + Improve Mode (AI tab):**
- Leadership AI companion (reuses the streaming chat infrastructure from `CeoAiChat`)
- Different system prompt focused on translation, problem-solving, execution improvement
- Structured responses: what is actually happening → signal vs noise → root cause → options → recommended action → immediate next steps

### 4. Upward Flow Actions
From the leadership dashboard, allow structured upward proposals:
- Propose Strategy Change
- Escalate Constraint
- Request Decision
- Flag Misalignment

Each requires structured input (not free-form). Sent to CEO Review Feed.

### 5. Leadership AI Edge Function (`supabase/functions/leadership-chat/index.ts`)
A new edge function with a leadership-focused system prompt. Uses the same Lovable AI Gateway. Context includes: department data, active strategy items for that department, translation blocks, and execution snapshot.

### 6. Navigation Updates
- Add "Leadership" nav item in sidebar (visible to all users, each sees their department)
- Admin toggle already exists; leadership dashboard accessible regardless of role (department leads)

## Files to Create
| File | Purpose |
|------|---------|
| `src/lib/strategy-flow.ts` | Strategy items context, types, localStorage persistence |
| `src/pages/LeadershipDashboard.tsx` | Leadership dashboard with execution + think modes |
| `src/components/StrategyItemCreator.tsx` | CEO creates/edits strategy items |
| `src/components/StrategyFeed.tsx` | Incoming strategy items feed (used by leadership) |
| `src/components/TranslationBlock.tsx` | Leadership translation form per strategy item |
| `src/components/CeoReviewFeed.tsx` | CEO reviews leadership proposals/escalations |
| `src/components/UpwardProposal.tsx` | Form for leadership to send structured proposals up |
| `src/components/LeadershipAiChat.tsx` | AI companion for leadership (different prompt) |
| `src/components/ExecutionSnapshot.tsx` | Shows projects/tasks/blockers tied to strategy |
| `supabase/functions/leadership-chat/index.ts` | Leadership AI edge function |

## Files to Modify
| File | Change |
|------|--------|
| `src/pages/CeoDashboard.tsx` | Add Strategy Items Manager + CEO Review Feed sections |
| `src/App.tsx` | Add `/leadership/:deptId` route, wrap with StrategyFlowProvider |
| `src/components/AppSidebar.tsx` | Add Leadership nav item |

## System Rules Enforced
- Strategy items cannot reach operations without a leadership translation block
- Leadership must acknowledge before translating; must translate before executing
- All upward feedback uses structured forms (no free-form)
- CEO AI focuses on strategy/direction; Leadership AI focuses on translation/execution
- Status progression is enforced: new → acknowledged → translated → in_execution → resolved

## Build Order
1. Strategy flow data model + context provider
2. Strategy item creator (CEO side)
3. CEO Review Feed component
4. Update CEO Dashboard with new sections
5. Strategy Feed + Translation Block (leadership side)
6. Execution Snapshot component
7. Upward Proposal form
8. Leadership Dashboard page (both modes)
9. Leadership AI edge function + chat component
10. Routing + sidebar updates

