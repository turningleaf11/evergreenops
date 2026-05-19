export type OrbitTrack = "dts" | "dta" | "deal_scout" | "closer" | "underwriting" | "d4";
export type OrbitStatus = "active" | "on_notice" | "graduated" | "removed";

export const TRACK_OPTIONS: { value: OrbitTrack; label: string }[] = [
  { value: "dts", label: "Direct to Seller" },
  { value: "dta", label: "Direct to Agent" },
  { value: "deal_scout", label: "Deal Scout" },
  { value: "closer", label: "Closer" },
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
  active: "bg-emerald-100 text-emerald-700",
  on_notice: "bg-amber-100 text-amber-700",
  graduated: "bg-blue-100 text-blue-700",
  removed: "bg-muted text-muted-foreground",
};

export const TRACK_COLORS: Record<OrbitTrack, string> = {
  dts: "bg-sky-100 text-sky-700",
  dta: "bg-violet-100 text-violet-700",
  deal_scout: "bg-rose-100 text-rose-700",
  closer: "bg-emerald-100 text-emerald-700",
  underwriting: "bg-indigo-100 text-indigo-700",
  d4: "bg-amber-100 text-amber-700",
};

export const TRACK_ACCENT: Record<OrbitTrack, string> = {
  dts: "hsl(199 89% 48%)",
  dta: "hsl(258 90% 66%)",
  deal_scout: "hsl(347 77% 50%)",
  closer: "hsl(142 71% 45%)",
  underwriting: "hsl(231 48% 48%)",
  d4: "hsl(38 92% 50%)",
};

export const TRACK_LABEL: Record<OrbitTrack, string> = Object.fromEntries(
  TRACK_OPTIONS.map((t) => [t.value, t.label])
) as Record<OrbitTrack, string>;

export const STATUS_LABEL: Record<OrbitStatus, string> = Object.fromEntries(
  STATUS_OPTIONS.map((s) => [s.value, s.label])
) as Record<OrbitStatus, string>;

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

// ─── Static role content ────────────────────────────────────────────────────

export interface TrackKpi {
  label: string;
  target: string;
  startingWhen: string;
}

export interface TrackFlowStep {
  label: string;
  note?: string;
  isHighlight?: boolean;
}

export interface TrackDailyStep {
  step: number;
  title: string;
  description: string;
}

export interface TrackContent {
  tagline: string;
  whatItIs: string;
  flow: TrackFlowStep[];
  dailySteps: TrackDailyStep[];
  kpis: TrackKpi[];
  successCriteria: string[];
  gettingStarted: string[];
  pillars?: { label: string; icon: string }[];
}

export const TRACK_CONTENT: Partial<Record<OrbitTrack, TrackContent>> = {
  dts: {
    tagline: "The front line of acquisitions. You talk to sellers — this is where deals begin.",
    whatItIs:
      "Direct to Seller means reaching out to property owners by phone and text, having real conversations, and moving motivated sellers toward an offer. You're building one of the most valuable skills in real estate: the ability to connect with a stranger and understand their situation.",
    flow: [
      { label: "Seller lead assigned in GHL" },
      { label: "DTS outreach (call + text)" },
      { label: "Conversation — qualify + engage", isHighlight: true },
      { label: "Mark Warm – Interested" },
      { label: "Closer picks up from smart list" },
    ],
    dailySteps: [
      {
        step: 1,
        title: "Check your tasks in GHL",
        description: "Go to Contacts → Tasks → Due Today, then Overdue. Filter by your name.",
      },
      {
        step: 2,
        title: "Work your smart list",
        description:
          "📬 Replied – Needs Attention first (same day/ASAP). Then 🤝 Ready for Handoff — confirm closer picked it up.",
      },
      {
        step: 3,
        title: "Call first. Always.",
        description:
          "Use the script early on — it exists because it works. Text if no answer. Your goal is a real conversation, not a perfect pitch.",
      },
      {
        step: 4,
        title: "Log disposition after every call",
        description:
          "Non-negotiable. Every touch gets logged immediately. Connected, No Answer, Left Voicemail, Appointment Set — log it.",
      },
      {
        step: 5,
        title: "Update lead status",
        description:
          "Cold → Warm Engaged → Warm Interested → Handoff. When status = Warm Interested, the closer's smart list picks it up automatically.",
      },
    ],
    kpis: [
      { label: "Calls per day", target: "50", startingWhen: "Week 1" },
      { label: "Appointments set per day", target: "3", startingWhen: "Week 2" },
    ],
    successCriteria: [
      "Working tasks and smart list every single day",
      "Leads moving from Cold → Warm Engaged or Appt. Set",
      "Every call logged with a disposition immediately",
      "Lead statuses always current — no stale entries",
      "Good notes on every contact",
      "Lead sheets filled out fully on real conversations",
    ],
    gettingStarted: [
      "Receive your GHL login and confirm you can see assigned leads",
      "Get your phone set up for outbound calling",
      "Read through the Warm Lead Script",
      "Review the Lead Sheet Guide — know how folders work",
      "Watch the GHL walkthrough video",
      "Make your first call",
    ],
  },

  dta: {
    tagline: "Relationship-based outreach to agents. Every conversation is a seed.",
    whatItIs:
      "Direct to Agent means fielding responses from our bulk agent outreach campaigns, representing the company with warmth and professionalism, and turning conversations into lasting relationships. The specific property usually won't close — but the agent who likes working with us will bring us the right one later.",
    pillars: [
      { label: "Price", icon: "💰" },
      { label: "Motivation", icon: "🎯" },
      { label: "Timeline", icon: "📅" },
      { label: "Condition", icon: "🏚️" },
    ],
    flow: [
      { label: "Ops team sends bulk offer emails" },
      { label: "Agent responds" },
      { label: "You field + respond (same day)", isHighlight: true },
      { label: "Build relationship — update Agent Status" },
      { label: "Agent Status = Interested → Closer picks up" },
      { label: "Agent sends future deals ← the real win" },
    ],
    dailySteps: [
      {
        step: 1,
        title: "Monitor your inbox for responses",
        description: "Agent replies can come in at any hour. Check consistently throughout the day — every response is a priority.",
      },
      {
        step: 2,
        title: "Field every response — same day",
        description:
          "Read carefully. Respond promptly and professionally. Be human, not a bot. Use response templates as a starting point, not a script.",
      },
      {
        step: 3,
        title: "Know what to do with each response type",
        description:
          "Interested → qualify and move forward. Asking questions → answer thoroughly. Counter → flag for Acq Manager. Not right now → leave the door open graciously.",
      },
      {
        step: 4,
        title: "Log everything in GHL",
        description:
          "Every response received, every reply sent. Update Agent Status after every interaction. If it's not logged, it didn't happen.",
      },
      {
        step: 5,
        title: "Hand off warm agents immediately",
        description:
          "When an agent is cooperative on a deal, mark Agent Status = Interested. The closer's smart list picks it up automatically. Don't sit on warm agents.",
      },
    ],
    kpis: [
      { label: "New agent conversations / day", target: "50", startingWhen: "Week 6" },
      { label: "Follow-up touches per contact", target: "8–13", startingWhen: "Ongoing" },
      { label: "Consistent deal flow", target: "2–3 deals/month", startingWhen: "By 90 days of hitting KPIs" },
    ],
    successCriteria: [
      "Every response fielded the same day, professionally",
      "Agents are engaging and asking questions — conversations are alive",
      "GHL is clean and up to date at all times",
      "Warm agents moved forward quickly — no sitting on Interested leads",
      "Over time: agents reaching back out to us proactively with deals",
    ],
    gettingStarted: [
      "Receive GHL login and set up your email account",
      "Read through the Direct to Agent Call Script",
      "Review the DTA — How to Work in GHL guide",
      "Review the Agent Response Guide",
      "Confirm you can see assigned contacts in GHL",
      "Field your first response",
    ],
  },

  deal_scout: {
    tagline: "You find what others scroll past. Every submission is a shot at ownership.",
    whatItIs:
      "Deal Scouts find properties that match our buy box and submit them for the team to review. You'll learn to think like an investor — what makes a deal worth pursuing, where deals come from, and how to evaluate quickly. The best part: bring us a deal we close and you can be part of the ownership.",
    flow: [
      { label: "You find a potential deal" },
      { label: "Quick buy box check", isHighlight: true },
      { label: "Submit deal for review" },
      { label: "Acq Manager → Underwriting" },
      { label: "Contract + Closing" },
      { label: "You're a part owner ← the goal" },
    ],
    dailySteps: [
      {
        step: 1,
        title: "Open your deal sources",
        description:
          "MLS / Zillow / Realtor.com, Facebook Marketplace, Craigslist, wholesale groups. The more sources you're plugged into, the more deal flow you'll see.",
      },
      {
        step: 2,
        title: "Run every property through the buy box",
        description:
          "Property type, location, price range, condition, deal type. If you're not sure — submit it and ask. You'll learn the box faster from feedback than from second-guessing.",
      },
      {
        step: 3,
        title: "Submit clean, complete deals",
        description:
          "Address, asking price, source, property type, beds/baths, sq footage, estimated condition, listing link, notes. Complete submissions get reviewed faster.",
      },
      {
        step: 4,
        title: "Track your submissions",
        description: "Note which ones get reviewed, what feedback you receive, and what made the cut. Each submission sharpens your investor eye.",
      },
    ],
    kpis: [
      { label: "Deals screened per day", target: "Set by your lead", startingWhen: "Week 1" },
      { label: "Deals submitted that fit buy box", target: "Set by your lead", startingWhen: "Week 1" },
    ],
    successCriteria: [
      "Searching every day and submitting consistently",
      "Submissions are clean and complete — no missing fields",
      "Deals you send are getting closer to the buy box over time",
      "Building your investor eye — seeing what others scroll past",
      "Bring a deal we move forward on — be part of it",
    ],
    gettingStarted: [
      "Review the buy box criteria on your track page",
      "Bookmark your primary deal sources (Zillow, Realtor.com, FB Marketplace)",
      "Review the deal submission form and template",
      "Watch the deal evaluation walkthrough video",
      "Submit your first deal",
    ],
  },

  closer: {
    tagline: "You take the warm lead and turn it into a signed contract.",
    whatItIs:
      "Closers receive qualified seller leads from DTS — people who are motivated, engaged, and ready to talk numbers. Your job is to build trust fast, understand the seller's situation deeply, present the right offer, and get the contract signed. You're the final step between a lead and a deal.",
    flow: [
      { label: "DTS marks lead Warm – Interested" },
      { label: "Lead appears on your smart list" },
      { label: "You conduct the appointment", isHighlight: true },
      { label: "Run offer & negotiation framework" },
      { label: "Contract signed → pipeline moves forward" },
    ],
    dailySteps: [
      {
        step: 1,
        title: "Check your smart list in GHL",
        description:
          "Your queue is Warm – Interested leads from DTS. Work in priority order — recency matters, warm leads cool fast.",
      },
      {
        step: 2,
        title: "Review the lead before calling",
        description: "Read the notes, check the lead sheet, understand the situation. Know their motivation, timeline, and condition before you dial.",
      },
      {
        step: 3,
        title: "Conduct the appointment",
        description:
          "Build rapport → confirm situation → present offer → handle objections → move toward a decision. Use the inbound seller calling guide.",
      },
      {
        step: 4,
        title: "Log disposition and update pipeline",
        description:
          "Appointment Completed, Offer Made, Under Negotiation, Contract Signed, Dead — every outcome logged. Move the opportunity stage in GHL immediately.",
      },
      {
        step: 5,
        title: "Follow up fast on pending deals",
        description: "If they didn't sign, a fast and professional follow-up is often what closes it. Same day or next day — don't let it go cold.",
      },
    ],
    kpis: [
      { label: "Appointments conducted per week", target: "Set by manager", startingWhen: "Week 1" },
      { label: "Offer-to-contract conversion", target: "Target set by lead", startingWhen: "Ongoing" },
      { label: "Contracts per month", target: "Set by manager", startingWhen: "By 30 days" },
    ],
    successCriteria: [
      "Working smart list every day — no warm leads sitting untouched",
      "Every appointment prepped — notes reviewed before calling",
      "Offers being made on qualified leads consistently",
      "Objections handled with the framework, not improvised",
      "Pipeline stages in GHL always current and accurate",
      "Follow-ups on pending deals happening same or next day",
    ],
    gettingStarted: [
      "Receive GHL login and confirm access to Closer smart list",
      "Read the Inbound Seller Lead Calling Guide",
      "Review the Offer & Negotiation Framework",
      "Read How Closers Work in GHL",
      "Review the Closer Training Guide",
      "Shadow or listen to a recorded closer call",
    ],
  },
};
