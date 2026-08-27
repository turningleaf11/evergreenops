// statusTone — the canonical "what color is this status?" map for the
// whole app. Every entity type that has a status field registers its
// values here so the StatusPill component renders consistently.
//
// HSL tokens (not hex). Each tone group is curated so similar concepts
// across entities ("done" / "won" / "completed" / "converted") all map
// to the same hue. That's what makes the app feel systematic.

// ── Tone families (the only colors a status pill is allowed to use) ─────────

const TONE = {
  success:  "152 65% 42%",   // emerald — completion, healthy, won
  info:     "215 80% 55%",   // azure — in-progress, active, info
  warning:  "32  92% 52%",   // amber — at risk, behind, warning
  danger:   "0   72% 52%",   // red — blocked, lost, off-track
  accent:   "262 65% 60%",   // violet — special states (qualified, review)
  neutral:  "220 12% 55%",   // gray — not started, todo, archived
} as const;

// ── Entity kinds the registry knows about ─────────────────────────────────

export type EntityKind =
  | "goal" | "project" | "task" | "issue"
  | "deal" | "lead" | "transaction" | "contact"
  | "thread" | "buyer_interest" | "deal_stage" | "business_plan"
  | "market" | "market_rating";

interface Tone { hsl: string; label: string; }

// Helper: map a status value to a tone family, with a fallback to neutral.
function tone(family: keyof typeof TONE, label: string): Tone {
  return { hsl: TONE[family], label };
}

// ── Per-entity registries ──────────────────────────────────────────────────

const GOAL: Record<string, Tone> = {
  on_track: tone("success", "On Track"),
  behind:   tone("warning", "Behind"),
  at_risk:  tone("danger",  "At Risk"),
  done:     tone("success", "Done"),
  not_done: tone("neutral", "Not Done"),
};

const PROJECT: Record<string, Tone> = {
  not_started: tone("neutral", "Not Started"),
  in_progress: tone("info",    "In Progress"),
  at_risk:     tone("warning", "At Risk"),
  blocked:     tone("danger",  "Blocked"),
  done:        tone("success", "Done"),
};

// Agent (AI) tasks share this same registry as human tasks — an agent
// task should never look like a different product from a human one.
// Both `tasks.status` and `agent_tasks.status` use these exact 7 keys,
// literally — no bucketing/aliasing layer on top. A card's status badge
// must always equal a real column on whichever board it's rendered in;
// don't reintroduce synonym keys here to paper over a board that hasn't
// added the matching column.
const TASK: Record<string, Tone> = {
  backlog:     tone("neutral", "Backlog"),
  todo:        tone("neutral", "To Do"),
  in_progress: tone("info",    "In Progress"),
  blocked:     tone("danger",  "Blocked"),
  review:      tone("accent",  "Review"),
  approved:    tone("accent",  "Approved"),
  done:        tone("success", "Done"),
};

const ISSUE: Record<string, Tone> = {
  open:        tone("warning", "Open"),
  identifying: tone("info",    "Identifying"),
  discussing:  tone("accent",  "Discussing"),
  solved:      tone("success", "Solved"),
  dismissed:   tone("neutral", "Dismissed"),
};

const DEAL: Record<string, Tone> = {
  open: tone("info",    "Open"),
  won:  tone("success", "Won"),
  lost: tone("danger",  "Lost"),
};

const LEAD: Record<string, Tone> = {
  new:          tone("info",    "New"),
  working:      tone("warning", "Working"),
  qualified:    tone("accent",  "Qualified"),
  converted:    tone("success", "Converted"),
  archived:     tone("neutral", "Archived"),
  disqualified: tone("neutral", "Disqualified"),
};

const TRANSACTION: Record<string, Tone> = {
  active:    tone("info",    "Active"),
  closed:    tone("success", "Closed"),
  cancelled: tone("neutral", "Cancelled"),
};

const CONTACT: Record<string, Tone> = {
  lead:     tone("info",    "Lead"),
  active:   tone("success", "Active"),
  customer: tone("accent",  "Customer"),
  lost:     tone("danger",  "Lost"),
};

const THREAD: Record<string, Tone> = {
  open:     tone("info",    "Open"),
  resolved: tone("success", "Resolved"),
};

// A buyer's interest in one specific deal (dispo_deal_interests.level).
// This is the many-to-many state GHL can't model: one buyer ↔ many deals,
// each pairing carrying its own stage from first interest through purchase.
const BUYER_INTEREST: Record<string, Tone> = {
  interested:        tone("info",    "Interested"),
  requested_info:    tone("info",    "Requested Info"),
  showing_scheduled: tone("accent",  "Showing Scheduled"),
  offer:             tone("warning", "Offer"),
  backup:            tone("neutral", "Backup"),
  won:               tone("success", "Won"),
  passed:            tone("neutral", "Passed"),
  dead:              tone("danger",  "Dead"),
};

// The deal lifecycle stage (dispo -> handoff -> TC -> terminal). Kept in sync
// with DEAL_STAGES in src/lib/dealVocab.ts — add stages in both places.
const DEAL_STAGE: Record<string, Tone> = {
  prep:              tone("neutral", "Prep"),
  ready:             tone("info",    "Ready"),
  marketing_live:    tone("info",    "Marketing Live"),
  marketing_paused:  tone("warning", "Marketing Paused"),
  buyer_qualifying:  tone("accent",  "Buyer Found / Qualifying"),
  buyer_selected:    tone("accent",  "Buyer Selected"),
  send_assignment:   tone("accent",  "Send Assignment"),
  pending_signature: tone("warning", "Pending Signature"),
  pending_emd:       tone("danger",  "Pending EMD"),
  title_dd:          tone("warning", "Title / Due Diligence"),
  clear_to_close:    tone("info",    "Clear to Close"),
  closed_won:        tone("success", "Closed – Won"),
  lost_dead:         tone("danger",  "Lost / Dead"),
};

// A business venture/line's overall stage — separate from project/task
// status since a plan doesn't "complete," it matures.
const BUSINESS_PLAN: Record<string, Tone> = {
  planning: tone("neutral", "Planning"),
  building: tone("info",    "Building"),
  scaling:  tone("success", "Scaling"),
  paused:   tone("warning", "Paused"),
};

// A market's overall Go/Watch/No-go call from the market scorecard rubric.
const MARKET: Record<string, Tone> = {
  go:     tone("success", "Go"),
  watch:  tone("warning", "Watch"),
  no_go:  tone("danger",  "No-go"),
};

// A single scorecard row's rating (market_scorecard_rows.rating) — the
// green/yellow/red rubric grade, not a lifecycle status.
const MARKET_RATING: Record<string, Tone> = {
  green:  tone("success", "Green"),
  yellow: tone("warning", "Yellow"),
  red:    tone("danger",  "Red"),
};

const REGISTRY: Record<EntityKind, Record<string, Tone>> = {
  goal: GOAL, project: PROJECT, task: TASK, issue: ISSUE,
  deal: DEAL, lead: LEAD, transaction: TRANSACTION, contact: CONTACT,
  thread: THREAD, buyer_interest: BUYER_INTEREST, deal_stage: DEAL_STAGE,
  business_plan: BUSINESS_PLAN, market: MARKET, market_rating: MARKET_RATING,
};

// ── Public API ─────────────────────────────────────────────────────────────

export function resolveStatusTone(kind: EntityKind, value: string): Tone {
  const reg = REGISTRY[kind];
  const hit = reg?.[value];
  if (hit) return hit;
  // Graceful fallback for unknown values — pretty-print the raw value.
  return {
    hsl: TONE.neutral,
    label: value.replace(/_/g, " "),
  };
}

export interface ToneOption extends Tone { value: string; }

/** Every status value registered for a kind — backs StatusPill's edit dropdown. */
export function listStatusOptions(kind: EntityKind): ToneOption[] {
  return Object.entries(REGISTRY[kind]).map(([value, t]) => ({ value, ...t }));
}

// ── Priority tones (separate scale — semantic, not entity-typed) ──────────

const PRIORITY: Record<string, Tone> = {
  low:    tone("neutral", "Low"),
  medium: tone("info",    "Medium"),
  high:   tone("warning", "High"),
  urgent: tone("danger",  "Urgent"),
};

export function resolvePriorityTone(value: string): Tone {
  return PRIORITY[value] ?? tone("neutral", value);
}

/** Every priority value — backs PriorityPill's edit dropdown. */
export function listPriorityOptions(): ToneOption[] {
  return Object.entries(PRIORITY).map(([value, t]) => ({ value, ...t }));
}
