export type OrbitTrack = "dts" | "dta" | "dtb" | "dtw" | "deal_scout" | "underwriting" | "d4" | "closer";
export type OrbitStatus = "active" | "on_notice" | "graduated" | "removed";

export const TRACK_OPTIONS: { value: OrbitTrack; label: string }[] = [
  { value: "dts", label: "DTS" },
  { value: "dta", label: "DTA" },
  { value: "dtb", label: "DTB" },
  { value: "dtw", label: "DTW" },
  { value: "closer", label: "Closer" },
  { value: "deal_scout", label: "Deal Scout" },
  { value: "underwriting", label: "Underwriting" },
  { value: "d4", label: "D4$" },
];

export const STATUS_OPTIONS: { value: OrbitStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "on_notice", label: "On Notice" },
  { value: "graduated", label: "Graduated" },
  { value: "removed", label: "Removed" },
];

export const STATUS_COLORS: Record<OrbitStatus, string> = {
  active: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  on_notice: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  graduated: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  removed: "bg-muted text-muted-foreground",
};

export const TRACK_COLORS: Record<OrbitTrack, string> = {
  dts:         "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  dta:         "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  dtb:         "bg-teal-500/15 text-teal-700 dark:text-teal-300",
  dtw:         "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  closer:      "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  deal_scout:  "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  underwriting:"bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  d4:          "bg-amber-500/15 text-amber-700 dark:text-amber-300",
};

/**
 * Accent colors used for borders, glows, KPI cards, numbered step badges in
 * the Orbit Program overview. One hex per track keeps the workbook visual
 * language consistent — same color you see on the role card runs through
 * every supporting element on that role's overview.
 */
export const TRACK_ACCENT: Record<OrbitTrack, string> = {
  dts:          "#0EA5E9",  // sky-500
  dta:          "#0F6E56",  // evergreen
  dtb:          "#14B8A6",  // teal-500
  dtw:          "#F97316",  // orange-500
  closer:       "#10B981",  // emerald-500
  deal_scout:   "#F43F5E",  // rose-500
  underwriting: "#6366F1",  // indigo-500
  d4:           "#F59E0B",  // amber-500
};

export const TRACK_LABEL: Record<OrbitTrack, string> = Object.fromEntries(
  TRACK_OPTIONS.map((t) => [t.value, t.label])
) as Record<OrbitTrack, string>;

export const STATUS_LABEL: Record<OrbitStatus, string> = Object.fromEntries(
  STATUS_OPTIONS.map((s) => [s.value, s.label])
) as Record<OrbitStatus, string>;

// ── Structured role content (workbook-style) ────────────────────────────────

export interface KpiSpec {
  metric: string;
  target: string;
  starting_when: string;
}

export interface DailyStep {
  title: string;
  detail: string;
}

export interface ChecklistSeed {
  key: string;
  label: string;
}

export interface TrackContent {
  full_name: string;
  tagline: string;
  what_it_is: string;
  kpis: KpiSpec[];
  daily_flow: DailyStep[];
  success_criteria: string[];
  getting_started: ChecklistSeed[];
}

// ── DB-row interfaces (mirrored from orbit_* tables) ────────────────────────

export interface OrbitMember {
  id: string;
  user_id: string;
  department_id: string;
  track: OrbitTrack;
  status: OrbitStatus;
  joined_at: string;
  track_started_at: string;
  graduated_at: string | null;
  removed_at: string | null;
  removal_reason: string | null;
  notes: string;
  ghl_user_id: string | null;
  ghl_synced_at: string | null;
}

export interface OrbitChecklistItem {
  id: string;
  member_id: string;
  item_key: string;
  label: string;
  sort_order: number;
  done: boolean;
  done_at: string | null;
  done_by: string | null;
  notes: string;
}

export interface OrbitStrike {
  id: string;
  member_id: string;
  strike_number: number;
  issued_at: string;
  issued_by: string | null;
  issued_by_name: string | null;
  reason: string;
  notes: string;
}

export interface OrbitPerformance {
  id: string;
  member_id: string;
  snapshot_date: string;
  calls_made: number;
  appointments_set: number;
  conversations: number;
  deals_closed: number;
  source: "manual" | "ghl";
  notes: string;
}

// ── Track content map ───────────────────────────────────────────────────────

export const TRACK_CONTENT: Record<OrbitTrack, TrackContent> = {
  dts: {
    full_name: "Direct to Seller",
    tagline: "Cold-call distressed sellers, build a pipeline through consistency.",
    what_it_is: "Outbound calls to homeowners on motivated-seller lists. You're building rapport, finding the four pillars (price, motivation, timeline, condition) and converting cold contacts into deals through disciplined follow-up.",
    kpis: [
      { metric: "Dials / day",       target: "150",         starting_when: "Week 2" },
      { metric: "Conversations / day", target: "20",        starting_when: "Week 2" },
      { metric: "Appointments set / week", target: "5",      starting_when: "Week 4" },
      { metric: "Deals closed",      target: "1 / quarter", starting_when: "By 90 days" },
    ],
    daily_flow: [
      { title: "Open your list", detail: "Pull today's call list from GHL / Lead Lists Master SOP. Get your headset on, water nearby, do not start without a list." },
      { title: "Dial in 90-minute blocks", detail: "No multitasking. Dial through the list, log every outcome in GHL. Two blocks before lunch, two after." },
      { title: "Listen for the four pillars", detail: "Price · Motivation · Timeline · Condition. If you get all four, you have a deal lead. If you get two, you have a follow-up." },
      { title: "Update lead status", detail: "Every call gets a disposition. No call goes unlogged. This is how the pipeline gets built." },
      { title: "Set tomorrow's follow-ups", detail: "End of day: review your hot list, schedule callbacks. Consistency = pipeline." },
    ],
    success_criteria: [
      "Hitting KPIs for 90 consecutive days",
      "Closed your first deal end-to-end",
      "Demonstrated mastery of the four pillars on recorded calls",
      "Can run an inbound seller call without supervision",
    ],
    getting_started: [
      { key: "ghl_access",         label: "GHL account access" },
      { key: "phone_setup",        label: "Phone setup + dialer working" },
      { key: "read_warm_script",   label: "Read the Warm Lead Script end-to-end" },
      { key: "read_cold_script",   label: "Read the Cold Call Script - Seller Lead" },
      { key: "shadow_5_calls",     label: "Shadow 5 calls with a senior closer" },
      { key: "first_50_dials",     label: "Complete your first 50 dials" },
      { key: "first_disposition",  label: "Log your first disposition correctly" },
      { key: "objection_playbook", label: "Read the Objection Handling Playbook" },
    ],
  },
  dta: {
    full_name: "Direct to Agent",
    tagline: "Relationship-based outreach to agents. Agents become your free lead source.",
    what_it_is: "Build relationships with licensed real estate agents to identify on and off-market opportunities. Every conversation is the beginning of a relationship — success is in the follow-up, not the first call.",
    kpis: [
      { metric: "New agent conversations / day", target: "50",         starting_when: "Week 6" },
      { metric: "Follow-up touches per contact", target: "8–13",       starting_when: "Ongoing" },
      { metric: "Consistent deal flow",          target: "2–3 deals/month", starting_when: "By 90 days of hitting KPIs" },
    ],
    daily_flow: [
      { title: "Start with your agent list", detail: "Open your computer, get to your list, start making calls. No warm-up — the list is the warm-up." },
      { title: "Every call is the start of a relationship", detail: "You're building an agent who calls YOU first when they have something distressed." },
      { title: "Follow up 8–13 times per initial contact", detail: "Pipeline is built in the follow-up. Consistency is the strategy. The deal emerges on touch 7, 8, 19, 20…" },
      { title: "Listen for the four pillars", detail: "When you get in front of a potential deal: Price · Motivation · Timeline · Condition. Those tell you everything." },
      { title: "Add every agent to your follow-up database", detail: "No agent left out. The pipeline is the database. Success is in the follow-up." },
    ],
    success_criteria: [
      "Hitting 50 new conversations / day for 90 days",
      "Maintained 8–13 touch cadence across your book",
      "Closed your first agent-sourced deal",
      "Can run the DTA call without a script",
    ],
    getting_started: [
      { key: "ghl_access",          label: "GHL account access" },
      { key: "agent_list_built",    label: "Build your starting agent list (200+)" },
      { key: "read_dta_script",     label: "Read the Direct to Agent Call Script" },
      { key: "read_dta_ghl",        label: "Read DTA — How To Work In GHL" },
      { key: "first_50_outreaches", label: "Complete first 50 agent outreaches" },
      { key: "agent_response_guide",label: "Read the Agent Response Guide" },
      { key: "first_conversation",  label: "Log your first 4-pillar conversation" },
    ],
  },
  // dtb/dtw: scorecard/roster-only for now — the per-person KPI (10 new
  // relationships/week) is real and drives the auto-scaled scorecard target,
  // but the rest of the workbook (daily flow, success criteria, getting
  // started) hasn't been written yet. Fill it in via the editor on this page
  // once the track has real workflow to document, rather than guessing here.
  dtb: {
    full_name: "Direct to Broker",
    tagline: "Relationship-based outreach to brokers.",
    what_it_is: "Build relationships with brokers who send deals your way — the DTB counterpart to DTA's agent outreach. Workbook content for this track (daily flow, success criteria, getting-started checklist) hasn't been written yet.",
    kpis: [
      { metric: "New broker relationships / week", target: "10", starting_when: "TBD" },
    ],
    daily_flow: [],
    success_criteria: [],
    getting_started: [],
  },
  dtw: {
    full_name: "Direct to Wholesaler",
    tagline: "Relationship-based outreach to wholesalers.",
    what_it_is: "Build relationships with wholesalers who send deals your way — the DTW counterpart to DTA's agent outreach. Workbook content for this track (daily flow, success criteria, getting-started checklist) hasn't been written yet.",
    kpis: [
      { metric: "New wholesaler relationships / week", target: "10", starting_when: "TBD" },
    ],
    daily_flow: [],
    success_criteria: [],
    getting_started: [],
  },
  closer: {
    full_name: "Closer",
    tagline: "Take warm leads to signed contract — the deal-closer specialist.",
    what_it_is: "Receive qualified leads from junior acquisitions and take them to a signed contract. Master of negotiation, offer structuring, and the senior call. You're the conversion engine at the end of the pipeline.",
    kpis: [
      { metric: "Senior calls / week", target: "10–15",         starting_when: "Week 2" },
      { metric: "Contract rate (calls → signed)", target: "20%+", starting_when: "Week 6" },
      { metric: "Deals closed / month", target: "3–5",          starting_when: "By 90 days" },
    ],
    daily_flow: [
      { title: "Review handoffs from junior acq", detail: "Every morning: pull the qualified leads queued from the team. Confirm the four pillars are documented before calling." },
      { title: "Run senior calls", detail: "Lead the conversation. Validate price, surface motivation, present offer structure options. You are the operator." },
      { title: "Structure the offer", detail: "Cash, terms, sub-to, novation. Pick the structure that fits the four pillars and protects the spread." },
      { title: "Negotiate to signed", detail: "Use the Offer & Negotiation Framework. Handle objections with the playbook. Get to paper." },
      { title: "Hand off to disposition", detail: "Contract signed → handoff package: address, contract, photos, notes. Disposition takes it from there." },
    ],
    success_criteria: [
      "Hitting 20%+ contract rate on senior calls for 90 days",
      "Closed 5+ deals end-to-end",
      "Can structure cash / terms / sub-to / novation deals without help",
      "Coaching junior acquisitions on senior calls",
    ],
    getting_started: [
      { key: "ghl_access",            label: "GHL account access" },
      { key: "closer_training_guide", label: "Read the Closer Training Guide" },
      { key: "closer_script",         label: "Read the Closer Script (Call 2)" },
      { key: "negotiation_framework", label: "Read the Offer & Negotiation Framework" },
      { key: "objection_playbook",    label: "Read the Objection Handling Playbook" },
      { key: "shadow_3_senior_calls", label: "Shadow 3 senior calls" },
      { key: "first_senior_call",     label: "Run your first senior call solo" },
      { key: "first_contract_signed", label: "Get your first contract signed" },
    ],
  },
  deal_scout: {
    full_name: "Deal Scout",
    tagline: "Hunt off-market deals across MLS, brokers, and creative lead sources.",
    what_it_is: "Identify deals before they hit the market. Build broker relationships, work MLS aggressively, and surface opportunities that fit the buy box across all 8 states.",
    kpis: [
      { metric: "Brokers contacted / week", target: "20", starting_when: "Week 4" },
      { metric: "Qualified deal leads / month", target: "10", starting_when: "Week 8" },
      { metric: "Deals handed to acquisitions / month", target: "2+", starting_when: "By 90 days" },
    ],
    daily_flow: [
      { title: "MLS sweep", detail: "Daily sweep of new listings + price drops in target markets. Flag anything matching the buy box." },
      { title: "Broker outreach", detail: "Work the broker list. Ask the magic question: 'Got anything pocket I could take a look at?' Every week, every broker." },
      { title: "Underwrite the maybes", detail: "Quick comps + numbers on anything worth a second look. Kill fast or escalate fast." },
      { title: "Hand off qualified leads", detail: "Deal lead matches buy box → package and hand to acquisitions for the senior call." },
    ],
    success_criteria: [
      "Built and maintain a 100+ broker book",
      "Consistent flow of 2+ qualified deals/month to acquisitions",
      "Closed first scout-sourced deal",
    ],
    getting_started: [
      { key: "buy_box_review",      label: "Review the buy box across all 8 states" },
      { key: "broker_list_started", label: "Start your broker list (target 100)" },
      { key: "read_broker_sop",     label: "Read the Broker List Building SOP" },
      { key: "first_broker_calls",  label: "Complete first 20 broker calls" },
      { key: "first_deal_handed",   label: "Hand your first qualified deal to acq" },
    ],
  },
  underwriting: {
    full_name: "Underwriting",
    tagline: "Run the numbers fast and right — the deal greenlighter.",
    what_it_is: "Take leads from acquisitions and quickly assess: is this a deal? Run comps, calculate ARV, build the offer math, flag the structure that fits. You are the firewall between bad deals and the team's time.",
    kpis: [
      { metric: "Deals underwritten / day",      target: "5–8",   starting_when: "Week 4" },
      { metric: "Turnaround time",               target: "<2 hrs", starting_when: "Week 6" },
      { metric: "Greenlit deals that close",     target: "30%+",   starting_when: "By 90 days" },
    ],
    daily_flow: [
      { title: "Pull the underwriting queue", detail: "Every lead from acquisitions hits your queue. Order by hottest first — fastest response wins deals." },
      { title: "Run comps + ARV", detail: "DealMachine + MLS + Zillow. Three comps minimum. Build the case for the ARV." },
      { title: "Build the offer math", detail: "Cash / terms / sub-to numbers. Subtract the spread, the rehab, the holding costs. Output: max offer." },
      { title: "Flag the structure", detail: "Which structure fits the seller's four pillars? Output the recommendation back to the closer." },
      { title: "Track the outcomes", detail: "Every greenlight gets watched: did it close? At what price? Update the model." },
    ],
    success_criteria: [
      "Consistent <2 hour turnaround on UW requests",
      "30%+ of greenlit deals close",
      "Can underwrite cash / terms / sub-to / novation without help",
    ],
    getting_started: [
      { key: "dscr_sop",            label: "Read SOP | Info Needed to Run DSCR" },
      { key: "comp_methodology",    label: "Learn the comp methodology" },
      { key: "first_5_underwrites", label: "Complete your first 5 underwrites with review" },
      { key: "first_greenlight",    label: "Greenlight your first deal solo" },
    ],
  },
  d4: {
    full_name: "D4$",
    tagline: "Capital + dispositions — partners and buyers, all in.",
    what_it_is: "Build the capital partner side: cash buyers, end investors, JV partners. Move signed contracts to the closing table fast. Master of the buyer network and the marketing automation.",
    kpis: [
      { metric: "Buyer outreach touches / day", target: "30",       starting_when: "Week 2" },
      { metric: "Deals dispositioned / month",  target: "3–5",      starting_when: "Week 8" },
      { metric: "Time on market",               target: "<14 days", starting_when: "By 90 days" },
    ],
    daily_flow: [
      { title: "Work the buyer list", detail: "Daily touches across the buyer network. New deals get blasted, stale buyers get revived." },
      { title: "Match deals to buyers", detail: "Every signed contract gets matched to 3+ buyers from the network. Personalize, send, follow up." },
      { title: "Run the marketing", detail: "TC, contracts, assignment closings. Automate where possible, white-glove where it matters." },
      { title: "Build the network", detail: "Every JV partner, every cash buyer goes into the database. The network compounds." },
    ],
    success_criteria: [
      "Built and maintain a 200+ buyer database",
      "Average <14 days on market",
      "Closed first JV partnership deal",
    ],
    getting_started: [
      { key: "buyer_database_built", label: "Build initial buyer database (50+)" },
      { key: "talking_to_buyers",    label: "Read the Talking to Buyers Script" },
      { key: "first_disposition",    label: "Dispo your first deal end-to-end" },
      { key: "first_jv_partner",     label: "Sign your first JV partner" },
    ],
  },
};
