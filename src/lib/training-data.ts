export type TrainingModuleType = "guide" | "playbook" | "checklist" | "video" | "link";
export type TrainingCategory = "Onboarding" | "Role Training" | "Processes" | "Tools";

export interface TrainingStep {
  id: string;
  title: string;
  content?: string;
  videoUrl?: string;
  externalUrl?: string;
  externalLabel?: string;
}

export interface TrainingModule {
  id: string;
  title: string;
  description: string;
  type: TrainingModuleType;
  category: TrainingCategory;
  roleIds: string[];
  steps: TrainingStep[];
  icon?: string;
}

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  link?: string;
  linkLabel?: string;
}

export const onboardingSteps: OnboardingStep[] = [
  {
    id: "welcome",
    title: "Welcome to Evergreen Real Estate Ventures",
    description: "Get familiar with how our team sources, underwrites, and closes real estate deals.",
  },
  {
    id: "meet-team",
    title: "Meet the team",
    description: "Browse the People directory to see who handles acquisitions, dispositions, and operations.",
    link: "/people",
    linkLabel: "View People",
  },
  {
    id: "explore-dept",
    title: "Explore your department",
    description: "Check your department page for current deals, priorities, and SOPs.",
    link: "/department/wholesale",
    linkLabel: "Go to Departments",
  },
  {
    id: "review-docs",
    title: "Review key SOPs",
    description: "Read through the Wholesale SOP, Underwriting Checklist, and Disposition Playbook.",
    link: "/docs",
    linkLabel: "Open Docs",
  },
  {
    id: "complete-training",
    title: "Complete role training",
    description: "Finish your role-specific training modules to get fully onboarded.",
    link: "/training",
    linkLabel: "Start Training",
  },
];

export const trainingModules: TrainingModule[] = [
  // Onboarding — visible to all
  {
    id: "company-overview",
    title: "Company Overview",
    description: "Understand Evergreen's mission, deal philosophy, and how the organization operates.",
    type: "guide",
    category: "Onboarding",
    roleIds: [],
    steps: [
      { id: "co-1", title: "Our Mission", content: "Evergreen Real Estate Ventures acquires undervalued properties through wholesale, fix-and-flip, and portfolio strategies. We create value for sellers, buyers, and our capital partners." },
      { id: "co-2", title: "Deal Philosophy", content: "1. Buy right — never chase a deal\n2. Speed to close is a competitive advantage\n3. Relationships over transactions\n4. Every deal must have a clear exit strategy before signing" },
      { id: "co-3", title: "How We Operate", content: "CEO sets strategic direction. Leadership translates strategy into department-level actions. Each deal flows through a structured pipeline: Lead → Analysis → Offer → Contract → DD → Close → Dispo." },
    ],
  },
  {
    id: "platform-basics",
    title: "Platform Basics",
    description: "Learn how to navigate the Evergreen platform and use core features.",
    type: "playbook",
    category: "Onboarding",
    roleIds: [],
    steps: [
      { id: "pb-1", title: "Navigation & Sidebar", content: "The sidebar gives you access to Home, Docs, Databases (Deal Pipeline, Comps, Dispo Board), People, and Training." },
      { id: "pb-2", title: "Documents & SOPs", content: "Create and edit documents with our block-based editor. Use slash commands (/) to insert headings, lists, callouts, and more. Key SOPs are pinned for each department." },
      { id: "pb-3", title: "Databases", content: "Databases track deals, comps, and dispositions. Each database has custom columns and views. Use the Deal Pipeline to track every lead from first contact to close." },
      { id: "pb-4", title: "Strategy Flow", content: "Strategy items flow from CEO → Department Leads → Execution. Watch for objectives and decisions assigned to your department." },
    ],
  },
  // Role-specific training
  {
    id: "acquisitions-training",
    title: "Acquisitions Training",
    description: "How to source, analyze, and lock up wholesale deals.",
    type: "playbook",
    category: "Role Training",
    roleIds: ["wholesale"],
    steps: [
      { id: "at-1", title: "Lead Generation", content: "Primary sources: driving for dollars, direct mail, cold calling, bandit signs, MLS expired/withdrawn, probate lists, tax delinquent lists. Goal: 50+ new leads per week per acquisitions rep." },
      { id: "at-2", title: "Seller Appointment Script", content: "Build rapport → Ask about the property situation → Understand their timeline and motivation → Present our offer as a solution. Never lead with price — lead with problem-solving." },
      { id: "at-3", title: "Making Offers", content: "Use the 70% Rule: MAO = ARV × 0.70 − Repairs − Assignment Fee. Always leave room for your buyer's profit. Run comps before every offer — no exceptions." },
      { id: "at-4", title: "Contract to Close", content: "Once under contract: 1) Open title immediately 2) Order inspection within 48 hrs 3) Upload to Deal Pipeline 4) Notify Dispo team for marketing 5) Monitor DD timeline" },
    ],
  },
  {
    id: "dispositions-training",
    title: "Dispositions Training",
    description: "How to market properties and close with end buyers.",
    type: "playbook",
    category: "Role Training",
    roleIds: ["dispositions"],
    steps: [
      { id: "dt-1", title: "Buyer List Management", content: "Segment buyers by: deal type preference, location, price range, proof of funds status. Update buyer activity monthly. Remove unresponsive buyers after 90 days." },
      { id: "dt-2", title: "Deal Marketing", content: "Within 24 hours of contract execution: create property flyer, blast email to relevant buyer segments, post on investor Facebook groups, and text top 20 buyers." },
      { id: "dt-3", title: "Closing Coordination", content: "Work with the Transaction Coordinator to schedule closing. Confirm buyer's POF/financing, clear title, and handle any assignment paperwork. Target: close within 14 days of buyer agreement." },
    ],
  },
  {
    id: "underwriting-training",
    title: "Underwriting & Comps Training",
    description: "How to evaluate deals, pull comps, and estimate rehab costs.",
    type: "checklist",
    category: "Role Training",
    roleIds: ["underwriting"],
    steps: [
      { id: "ut-1", title: "Pulling Comps", content: "Use MLS, PropStream, and county records. Find 3-5 comps within 0.5 miles, sold within last 6 months, similar bed/bath/sqft. Adjust for condition and location." },
      { id: "ut-2", title: "Rehab Estimation", content: "Use our Rehab Cost Matrix for standard line items. For major rehabs, get contractor bids. Categories: cosmetic ($15-25/sqft), moderate ($25-45/sqft), full gut ($45-75/sqft)." },
      { id: "ut-3", title: "Deal Scoring", content: "Score each deal 1-10 on: seller motivation, profit margin, exit certainty, timeline risk. Deals scoring below 6 should be deprioritized or renegotiated." },
    ],
  },
  {
    id: "transaction-coordination",
    title: "Transaction Coordination",
    description: "Closing process, title coordination, and compliance.",
    type: "checklist",
    category: "Role Training",
    roleIds: ["operations"],
    steps: [
      { id: "tc-1", title: "Opening Title", content: "Submit the executed contract to our preferred title company within 24 hours. Request a preliminary title report and verify no outstanding liens or judgments." },
      { id: "tc-2", title: "Managing the Closing Timeline", content: "Track all deadlines: inspection period, financing contingency, title clearance, closing date. Send daily status updates to the acquisitions and dispo teams." },
      { id: "tc-3", title: "Post-Closing", content: "Confirm recording of deed, distribute proceeds per HUD/ALTA statement, update Deal Pipeline status to 'Closed', archive all documents." },
    ],
  },
  // Processes
  {
    id: "communication-guide",
    title: "Communication Guidelines",
    description: "How we communicate as a team and make decisions.",
    type: "guide",
    category: "Processes",
    roleIds: [],
    steps: [
      { id: "cg-1", title: "Deal Updates", content: "Post deal status updates in the platform daily. Use the Deal Pipeline database as the single source of truth. Don't rely on text messages for deal status." },
      { id: "cg-2", title: "Escalation Process", content: "If a deal hits a blocker (title issue, seller backing out, financing problem), escalate immediately via an Upward Proposal in the Strategy system." },
      { id: "cg-3", title: "Weekly Meetings", content: "Monday: Pipeline review (all hands). Wednesday: Dispo status update. Friday: Wins & lessons learned. All meetings have agendas and action items logged in Docs." },
    ],
  },
  // Tools
  {
    id: "tools-overview",
    title: "Tools We Use",
    description: "Overview of key tools and how to access them.",
    type: "link",
    category: "Tools",
    roleIds: [],
    steps: [
      { id: "to-1", title: "Evergreen Platform (This App)", content: "Central hub for deal tracking, docs, strategy, and team collaboration." },
      { id: "to-2", title: "PropStream", content: "Property data, comps, and lead lists.", externalUrl: "https://www.propstream.com", externalLabel: "Open PropStream" },
      { id: "to-3", title: "BatchLeads", content: "Skip tracing and direct mail campaigns.", externalUrl: "https://batchleads.io", externalLabel: "Open BatchLeads" },
      { id: "to-4", title: "DocuSign", content: "Electronic signatures for contracts and assignments.", externalUrl: "https://www.docusign.com", externalLabel: "Open DocuSign" },
    ],
  },
];
