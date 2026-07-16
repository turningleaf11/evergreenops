// Controlled vocabularies shared by the deal form + buyer views. These MUST
// mirror the canonicalization the ghl-sync-buyers edge function applies, so a
// deal's property fields and a buyer's buy-box speak the same language and the
// buyer↔deal match actually joins.

export const US_STATES = [
  "Nationwide",
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado",
  "Connecticut", "Delaware", "District of Columbia", "Florida", "Georgia",
  "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky",
  "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota",
  "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire",
  "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota",
  "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina",
  "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia",
  "Washington", "West Virginia", "Wisconsin", "Wyoming",
] as const;

// Exit strategies — used for a deal's Best Exit AND a buyer's strategies.
export const EXIT_STRATEGIES = [
  "Fix & Flip", "Buy & Hold", "BRRRR", "Wholesale", "Short-Term Rental",
  "New Construction", "Commercial", "Multifamily", "Wrap", "Co-Living", "Group Home",
] as const;

export const PROPERTY_TYPES = [
  "Single Family Residence", "Multifamily 2-4 Units", "Multifamily 5+", "Townhouse",
  "Condo", "Mobile Home", "Mobile Home Park", "RV Park", "Land", "Commercial", "Portfolio",
] as const;

// The deal's single lifecycle stage. Dispo runs Prep -> Buyer Selected, hands
// off to TC (Send Assignment -> Clear to Close), then terminal. Mirrors the GHL
// pipeline so stage stays in one vocabulary across both systems.
export type StageGroup = "dispo" | "tc" | "terminal";
export interface DealStage {
  value: string;
  label: string;
  group: StageGroup;
  nextAction: string;
}

export const DEAL_STAGES: DealStage[] = [
  { value: "prep",              label: "Prep",                     group: "dispo",    nextAction: "Finish prep — photos, price, copy" },
  { value: "ready",             label: "Ready",                    group: "dispo",    nextAction: "Launch marketing" },
  { value: "marketing_live",    label: "Marketing Live",           group: "dispo",    nextAction: "Work inquiries → offers" },
  { value: "marketing_paused",  label: "Marketing Paused",         group: "dispo",    nextAction: "Resume or update the listing" },
  { value: "buyer_qualifying",  label: "Buyer Found / Qualifying", group: "dispo",    nextAction: "Qualify buyer (proof of funds)" },
  { value: "buyer_selected",    label: "Buyer Selected",           group: "dispo",    nextAction: "Hand to TC — send assignment" },
  { value: "send_assignment",   label: "Send Assignment",          group: "tc",       nextAction: "Send the assignment agreement" },
  { value: "pending_signature", label: "Pending Signature",        group: "tc",       nextAction: "Follow up for buyer signature" },
  { value: "pending_emd",       label: "Pending EMD",              group: "tc",       nextAction: "Confirm EMD — 24-hour deadline" },
  { value: "title_dd",          label: "Title / Due Diligence",    group: "tc",       nextAction: "Clear title / DD items" },
  { value: "clear_to_close",    label: "Clear to Close",           group: "tc",       nextAction: "Confirm the closing date" },
  { value: "closed_won",        label: "Closed – Won",             group: "terminal", nextAction: "" },
  { value: "lost_dead",         label: "Lost / Dead",              group: "terminal", nextAction: "" },
];

export const STAGE_BY_VALUE: Record<string, DealStage> =
  Object.fromEntries(DEAL_STAGES.map((s) => [s.value, s]));

export const DISPO_STAGES = DEAL_STAGES.filter((s) => s.group === "dispo").map((s) => s.value);
export const TC_STAGES = DEAL_STAGES.filter((s) => s.group === "tc").map((s) => s.value);
// Deals in these stages are "done" — hidden from the active command lists.
export const TERMINAL_STAGES = DEAL_STAGES.filter((s) => s.group === "terminal").map((s) => s.value);

// stage -> the deal's coarse status (keeps existing status-driven UI working)
export function statusForStage(stage: string): "active" | "closed" | "cancelled" {
  if (stage === "closed_won") return "closed";
  if (stage === "lost_dead") return "cancelled";
  return "active";
}
