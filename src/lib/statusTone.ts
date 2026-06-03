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
  | "thread";

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
  completed:   tone("success", "Completed"),
  done:        tone("success", "Done"),
};

const TASK: Record<string, Tone> = {
  todo:        tone("neutral", "To Do"),
  in_progress: tone("info",    "In Progress"),
  blocked:     tone("danger",  "Blocked"),
  done:        tone("success", "Done"),
};

const ISSUE: Record<string, Tone> = {
  open:      tone("warning", "Open"),
  in_review: tone("info",    "In Review"),
  resolved:  tone("success", "Resolved"),
  closed:    tone("neutral", "Closed"),
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

const REGISTRY: Record<EntityKind, Record<string, Tone>> = {
  goal: GOAL, project: PROJECT, task: TASK, issue: ISSUE,
  deal: DEAL, lead: LEAD, transaction: TRANSACTION, contact: CONTACT,
  thread: THREAD,
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
