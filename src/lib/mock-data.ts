export interface Department {
  id: string;
  name: string;
  description: string;
  icon: string;
  memberCount: number;
  color: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  departmentId: string | null;
  author: string;
  createdAt: string;
  pinned: boolean;
}

export type Visibility = "workspace" | "departments" | "private";

export interface SharedWith {
  departmentIds: string[];
  memberIds: string[];
}

export interface DocPage {
  id: string;
  title: string;
  content: string;
  parentId: string | null;
  visibility: Visibility;
  sharedWith: SharedWith;
  author: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
}

export type ColumnType = "text" | "long_text" | "number" | "currency" | "select" | "multi_select" | "date" | "person" | "checkbox" | "url" | "email" | "phone" | "progress" | "relation" | "status" | "tags" | "file";

export interface DatabaseColumn {
  id: string;
  name: string;
  type: ColumnType;
  options?: string[];
  required?: boolean;
  relationConfig?: { databaseId: string; multiple?: boolean };
}

export interface Database {
  id: string;
  title: string;
  description: string;
  icon: string;
  visibility: Visibility;
  sharedWith: SharedWith;
  createdBy: string;
  columns: DatabaseColumn[];
}

export interface DatabaseRow {
  id: string;
  databaseId: string;
  values: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  departmentId: string;
  avatar: string | null;
  joinedAt: string;
}

// ---- Departments ----

export const departments: Department[] = [
  { id: "wholesale", name: "Wholesale Acquisitions", description: "Source, negotiate, and close off-market wholesale deals", icon: "Home", memberCount: 6, color: "220 65% 48%" },
  { id: "portfolio", name: "Portfolio Acquisitions", description: "Acquire and manage multi-unit rental portfolios", icon: "Building2", memberCount: 4, color: "280 65% 48%" },
  { id: "dispositions", name: "Dispositions", description: "Market and sell acquired properties to end buyers", icon: "TrendingUp", memberCount: 4, color: "38 92% 50%" },
  { id: "underwriting", name: "Underwriting & Analysis", description: "Evaluate deals, run comps, and assess risk", icon: "Calculator", memberCount: 3, color: "142 71% 45%" },
  { id: "operations", name: "Operations & Transactions", description: "Coordinate closings, title, and compliance", icon: "Settings", memberCount: 3, color: "0 72% 51%" },
];

// ---- Announcements ----

export const announcements: Announcement[] = [
  { id: "a1", title: "Q2 Wholesale Pipeline Update", content: "We have 14 active leads in the wholesale pipeline. Focus this week: follow up on all leads with motivated sellers and push 3 deals to contract.", departmentId: null, author: "Marcus Reed", createdAt: "2026-04-08", pinned: true },
  { id: "a2", title: "Portfolio Acquisition Under LOI — 24-Unit Maple Ridge", content: "LOI accepted on Maple Ridge Apartments (24 units, $1.8M). Due diligence begins Monday. Underwriting team: prepare full analysis by Wednesday.", departmentId: "portfolio", author: "Marcus Reed", createdAt: "2026-04-07", pinned: false },
  { id: "a3", title: "New Buyer Added to Dispo List", content: "Cash buyer verified: GreenLight Capital, LLC — looking for 3-4 bed SFR in Fulton County under $180K ARV. Add to the next blast.", departmentId: "dispositions", author: "Jasmine Cole", createdAt: "2026-04-06", pinned: false },
];

// ---- Docs ----

export const docPages: DocPage[] = [
  { id: "d1", title: "Wholesale Acquisitions SOP", content: "<h2>Wholesale Deal Flow</h2><p>This SOP covers the end-to-end process for sourcing, analyzing, and closing wholesale real estate deals.</p><h3>Step 1: Lead Generation</h3><p>Sources include driving for dollars, direct mail campaigns, cold calling, and MLS expired listings.</p><h3>Step 2: Initial Screening</h3><p>Run quick comps, verify motivation, and estimate repair costs before scheduling an appointment.</p><div class=\"callout callout-warning\"><p>Warning: Never submit an offer without running comps and getting a preliminary rehab estimate.</p></div>", parentId: null, visibility: "workspace", sharedWith: { departmentIds: [], memberIds: [] }, author: "Marcus Reed", createdAt: "2026-03-01", updatedAt: "2026-04-05", tags: ["wholesale", "sop"] },
  { id: "d2", title: "Underwriting Checklist", content: "<h2>Deal Underwriting Checklist</h2><p>Use this checklist for every deal before submitting an offer.</p><ol><li>Pull 5+ comparable sales within 0.5 miles (last 6 months)</li><li>Estimate rehab costs with contractor or cost matrix</li><li>Calculate ARV (After Repair Value)</li><li>Apply the 70% rule: MAO = ARV × 0.70 − Repairs − Assignment Fee</li><li>Verify title status and liens</li><li>Confirm seller motivation and timeline</li></ol><div class=\"callout callout-info\"><p>Info: Use the Comps Database to log and share comparable sales data across the team.</p></div>", parentId: null, visibility: "departments", sharedWith: { departmentIds: ["underwriting", "wholesale"], memberIds: [] }, author: "Danielle Okafor", createdAt: "2026-03-10", updatedAt: "2026-04-02", tags: ["underwriting", "checklist"] },
  { id: "d3", title: "Disposition Playbook", content: "<h2>Disposition Strategy</h2><p>How we market and assign/close deals to end buyers.</p><h3>Buyer List Management</h3><p>Maintain a segmented buyer list: cash buyers, fix-and-flip investors, buy-and-hold investors, and owner-occupants. Update contact status monthly.</p><h3>Marketing Channels</h3><p>Blast new deals via email, SMS, and post on investor marketplaces within 24 hours of contract execution.</p>", parentId: null, visibility: "departments", sharedWith: { departmentIds: ["dispositions"], memberIds: [] }, author: "Jasmine Cole", createdAt: "2026-03-15", updatedAt: "2026-04-01", tags: ["dispositions", "playbook"] },
  { id: "d4", title: "Due Diligence Procedures", content: "<h2>Due Diligence</h2><p>Steps to complete during the inspection period for any acquisition.</p><ol><li>Order title search and review for liens, judgments, or encumbrances</li><li>Schedule property inspection (structural, roof, HVAC, plumbing, electrical)</li><li>Verify zoning and code compliance</li><li>Confirm insurance availability and cost</li><li>Review tenant leases (for portfolio acquisitions)</li></ol><div class=\"callout callout-success\"><p>Success: Complete DD within 10 business days to stay within contract timelines.</p></div>", parentId: null, visibility: "workspace", sharedWith: { departmentIds: [], memberIds: [] }, author: "Carlos Vega", createdAt: "2026-03-20", updatedAt: "2026-04-03", tags: ["due-diligence", "compliance"] },
  { id: "d5", title: "JV Partnership Guidelines", content: "<h2>Joint Venture Partnerships</h2><p>Guidelines for structuring JV deals with capital partners.</p><h3>Deal Structure</h3><p>Standard split: 70/30 (capital partner / operator). Adjust based on deal size, risk, and operator contribution.</p><h3>Required Documentation</h3><ul><li>JV Operating Agreement</li><li>Capital commitment schedule</li><li>Exit strategy and timeline</li><li>Profit distribution waterfall</li></ul>", parentId: null, visibility: "departments", sharedWith: { departmentIds: ["portfolio"], memberIds: [] }, author: "Marcus Reed", createdAt: "2026-03-25", updatedAt: "2026-04-04", tags: ["jv", "partnerships"] },
];

// ---- Database Templates ----

export const databaseTemplates: { id: string; title: string; description: string; icon: string; columns: DatabaseColumn[] }[] = [
  {
    id: "deal-pipeline", title: "Deal Pipeline", description: "Track wholesale and acquisition deals from lead to close", icon: "Target",
    columns: [
      { id: "address", name: "Property Address", type: "text", required: true },
      { id: "status", name: "Deal Status", type: "select", options: ["Lead", "Contacted", "Offer Sent", "Under Contract", "In DD", "Closing", "Closed", "Dead"] },
      { id: "acq_type", name: "Acquisition Type", type: "select", options: ["Wholesale", "Fix & Flip", "Buy & Hold", "Portfolio", "Subject-To", "Seller Finance"] },
      { id: "asking_price", name: "Asking Price", type: "number" },
      { id: "offer_price", name: "Offer Price", type: "number" },
      { id: "arv", name: "ARV", type: "number" },
      { id: "rehab_estimate", name: "Rehab Estimate", type: "number" },
      { id: "seller_contact", name: "Seller Contact", type: "text" },
      { id: "assignee", name: "Assigned To", type: "person" },
      { id: "dispo_strategy", name: "Disposition Strategy", type: "select", options: ["Assign Contract", "Double Close", "Novation", "Hold as Rental", "JV Partner"] },
      { id: "due_date", name: "Closing Date", type: "date" },
    ],
  },
  {
    id: "property-tracker", title: "Property Tracker", description: "Track property details, condition, and inspections", icon: "Home",
    columns: [
      { id: "address", name: "Address", type: "text", required: true },
      { id: "unit_count", name: "Unit Count", type: "number" },
      { id: "sqft", name: "Square Footage", type: "number" },
      { id: "condition", name: "Condition", type: "select", options: ["Excellent", "Good", "Fair", "Poor", "Needs Full Rehab"] },
      { id: "inspection_date", name: "Inspection Date", type: "date" },
      { id: "rehab_estimate", name: "Rehab Estimate", type: "number" },
      { id: "inspector", name: "Inspector", type: "person" },
      { id: "notes", name: "Notes", type: "text" },
    ],
  },
  {
    id: "disposition-board", title: "Disposition Board", description: "Manage property assignments and buyer closings", icon: "TrendingUp",
    columns: [
      { id: "property", name: "Property", type: "text", required: true },
      { id: "buyer", name: "Buyer", type: "text" },
      { id: "assignment_fee", name: "Assignment Fee", type: "number" },
      { id: "status", name: "Status", type: "select", options: ["Marketing", "Buyer Interested", "Under Contract", "Closing Scheduled", "Closed", "Fell Through"] },
      { id: "close_date", name: "Close Date", type: "date" },
      { id: "dispo_manager", name: "Dispo Manager", type: "person" },
    ],
  },
  {
    id: "comps", title: "Comps Database", description: "Comparable sales data for underwriting", icon: "Calculator",
    columns: [
      { id: "address", name: "Address", type: "text", required: true },
      { id: "sale_price", name: "Sale Price", type: "number" },
      { id: "sale_date", name: "Sale Date", type: "date" },
      { id: "sqft", name: "Sq Ft", type: "number" },
      { id: "price_sqft", name: "Price/Sq Ft", type: "number" },
      { id: "beds", name: "Beds", type: "number" },
      { id: "baths", name: "Baths", type: "number" },
      { id: "condition", name: "Condition", type: "select", options: ["As-Is", "Rehabbed", "New Construction"] },
      { id: "source", name: "Source", type: "select", options: ["MLS", "County Records", "Investor Network", "PropStream"] },
    ],
  },
  {
    id: "tasks", title: "Task List", description: "Simple task tracking with assignments", icon: "CheckSquare",
    columns: [
      { id: "title", name: "Title", type: "text", required: true },
      { id: "status", name: "Status", type: "select", options: ["To Do", "In Progress", "Done"] },
      { id: "priority", name: "Priority", type: "select", options: ["Low", "Medium", "High"] },
      { id: "assignee", name: "Assignee", type: "person" },
      { id: "due_date", name: "Due Date", type: "date" },
    ],
  },
  {
    id: "blank", title: "Blank Database", description: "Start from scratch", icon: "Plus",
    columns: [
      { id: "title", name: "Title", type: "text", required: true },
    ],
  },
];

// ---- Sample Databases ----

export const databases: Database[] = [
  {
    id: "db1", title: "Wholesale Deal Pipeline", description: "Active wholesale deals in the pipeline", icon: "Target",
    visibility: "workspace", sharedWith: { departmentIds: [], memberIds: [] }, createdBy: "Marcus Reed",
    columns: databaseTemplates[0].columns,
  },
  {
    id: "db2", title: "Disposition Board", description: "Properties being marketed to buyers", icon: "TrendingUp",
    visibility: "departments", sharedWith: { departmentIds: ["dispositions"], memberIds: [] }, createdBy: "Jasmine Cole",
    columns: databaseTemplates[2].columns,
  },
  {
    id: "db3", title: "Comps — Fulton County", description: "Recent comparable sales in Fulton County", icon: "Calculator",
    visibility: "departments", sharedWith: { departmentIds: ["underwriting", "wholesale"], memberIds: [] }, createdBy: "Danielle Okafor",
    columns: databaseTemplates[3].columns,
  },
];

export const databaseRows: DatabaseRow[] = [
  // Wholesale Deal Pipeline
  { id: "r1", databaseId: "db1", values: { address: "1423 Maple Dr, Atlanta, GA 30310", status: "Under Contract", acq_type: "Wholesale", asking_price: 145000, offer_price: 105000, arv: 210000, rehab_estimate: 45000, seller_contact: "James Whitfield (404-555-0123)", assignee: "Terrence Brooks", dispo_strategy: "Assign Contract", due_date: "2026-04-28" }, createdAt: "2026-04-01", updatedAt: "2026-04-10" },
  { id: "r2", databaseId: "db1", values: { address: "782 Oak Ridge Ln, Decatur, GA 30032", status: "Offer Sent", acq_type: "Wholesale", asking_price: 180000, offer_price: 130000, arv: 265000, rehab_estimate: 60000, seller_contact: "Linda Barrows (678-555-0456)", assignee: "Terrence Brooks", dispo_strategy: "Double Close", due_date: "2026-05-10" }, createdAt: "2026-04-03", updatedAt: "2026-04-09" },
  { id: "r3", databaseId: "db1", values: { address: "3901 Peachtree Industrial Blvd, Duluth, GA 30096", status: "Lead", acq_type: "Fix & Flip", asking_price: 220000, offer_price: null, arv: 340000, rehab_estimate: 75000, seller_contact: "Estate of R. Nguyen", assignee: "Keisha Monroe", dispo_strategy: "JV Partner", due_date: null }, createdAt: "2026-04-05", updatedAt: "2026-04-08" },
  { id: "r4", databaseId: "db1", values: { address: "567 Cascade Rd SW, Atlanta, GA 30311", status: "In DD", acq_type: "Wholesale", asking_price: 95000, offer_price: 68000, arv: 155000, rehab_estimate: 35000, seller_contact: "Tony Mitchell (404-555-0789)", assignee: "Terrence Brooks", dispo_strategy: "Assign Contract", due_date: "2026-04-22" }, createdAt: "2026-04-02", updatedAt: "2026-04-11" },

  // Disposition Board
  { id: "r5", databaseId: "db2", values: { property: "209 Glenwood Ave, East Point, GA 30344", buyer: "FlipStar Investments LLC", assignment_fee: 12000, status: "Under Contract", close_date: "2026-04-18", dispo_manager: "Jasmine Cole" }, createdAt: "2026-04-01", updatedAt: "2026-04-10" },
  { id: "r6", databaseId: "db2", values: { property: "1423 Maple Dr, Atlanta, GA 30310", buyer: "", assignment_fee: 15000, status: "Marketing", close_date: null, dispo_manager: "Jasmine Cole" }, createdAt: "2026-04-10", updatedAt: "2026-04-10" },

  // Comps
  { id: "r7", databaseId: "db3", values: { address: "1501 Maple Dr, Atlanta, GA 30310", sale_price: 205000, sale_date: "2026-03-15", sqft: 1450, price_sqft: 141, beds: 3, baths: 2, condition: "Rehabbed", source: "MLS" }, createdAt: "2026-03-20", updatedAt: "2026-03-20" },
  { id: "r8", databaseId: "db3", values: { address: "1389 Maple Dr, Atlanta, GA 30310", sale_price: 195000, sale_date: "2026-02-28", sqft: 1380, price_sqft: 141, beds: 3, baths: 2, condition: "Rehabbed", source: "County Records" }, createdAt: "2026-03-05", updatedAt: "2026-03-05" },
  { id: "r9", databaseId: "db3", values: { address: "790 Oak Ridge Ln, Decatur, GA 30032", sale_price: 270000, sale_date: "2026-03-01", sqft: 1800, price_sqft: 150, beds: 4, baths: 2, condition: "Rehabbed", source: "MLS" }, createdAt: "2026-03-10", updatedAt: "2026-03-10" },
];

// ---- Team Members ----

export const teamMembers: TeamMember[] = [
  { id: "m1", name: "Marcus Reed", email: "marcus@evergreenre.com", role: "CEO / Principal", departmentId: "wholesale", avatar: null, joinedAt: "2023-01-15" },
  { id: "m2", name: "Terrence Brooks", email: "terrence@evergreenre.com", role: "Acquisitions Manager", departmentId: "wholesale", avatar: null, joinedAt: "2023-06-01" },
  { id: "m3", name: "Keisha Monroe", email: "keisha@evergreenre.com", role: "Acquisitions Associate", departmentId: "wholesale", avatar: null, joinedAt: "2024-02-10" },
  { id: "m4", name: "Jasmine Cole", email: "jasmine@evergreenre.com", role: "Disposition Manager", departmentId: "dispositions", avatar: null, joinedAt: "2023-08-15" },
  { id: "m5", name: "Danielle Okafor", email: "danielle@evergreenre.com", role: "Lead Underwriter", departmentId: "underwriting", avatar: null, joinedAt: "2023-09-01" },
  { id: "m6", name: "Carlos Vega", email: "carlos@evergreenre.com", role: "Transaction Coordinator", departmentId: "operations", avatar: null, joinedAt: "2024-01-20" },
  { id: "m7", name: "Andre Washington", email: "andre@evergreenre.com", role: "Portfolio Analyst", departmentId: "portfolio", avatar: null, joinedAt: "2024-03-01" },
  { id: "m8", name: "Brittany Fields", email: "brittany@evergreenre.com", role: "Marketing Coordinator", departmentId: "dispositions", avatar: null, joinedAt: "2024-05-10" },
  { id: "m9", name: "Derek Lawson", email: "derek@evergreenre.com", role: "Property Inspector", departmentId: "underwriting", avatar: null, joinedAt: "2024-06-01" },
  { id: "m10", name: "Natasha Kim", email: "natasha@evergreenre.com", role: "Portfolio Acquisitions Lead", departmentId: "portfolio", avatar: null, joinedAt: "2024-04-15" },
];
