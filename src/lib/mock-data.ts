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

export type ColumnType = "text" | "number" | "select" | "multi_select" | "date" | "person" | "checkbox" | "url" | "progress";

export interface DatabaseColumn {
  id: string;
  name: string;
  type: ColumnType;
  options?: string[];
  required?: boolean;
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

export const departments: Department[] = [
  { id: "eng", name: "Engineering", description: "Building the future of our product", icon: "Code2", memberCount: 12, color: "220 65% 48%" },
  { id: "design", name: "Design", description: "Crafting beautiful user experiences", icon: "Palette", memberCount: 6, color: "280 65% 48%" },
  { id: "product", name: "Product", description: "Defining what we build and why", icon: "Lightbulb", memberCount: 5, color: "38 92% 50%" },
  { id: "marketing", name: "Marketing", description: "Telling our story to the world", icon: "Megaphone", memberCount: 8, color: "142 71% 45%" },
  { id: "ops", name: "Operations", description: "Keeping everything running smoothly", icon: "Settings", memberCount: 4, color: "0 72% 51%" },
];

export const announcements: Announcement[] = [
  { id: "a1", title: "Q2 Planning Kickoff", content: "All-hands meeting this Friday at 2pm to discuss Q2 goals and priorities.", departmentId: null, author: "Sarah Chen", createdAt: "2026-04-08", pinned: true },
  { id: "a2", title: "New Design System Released", content: "Check out the updated component library in our docs.", departmentId: "design", author: "Alex Rivera", createdAt: "2026-04-07", pinned: false },
  { id: "a3", title: "Infrastructure Migration Complete", content: "We've successfully migrated to the new cloud infrastructure.", departmentId: "eng", author: "Jordan Park", createdAt: "2026-04-06", pinned: false },
];

export const docPages: DocPage[] = [
  { id: "d1", title: "Getting Started Guide", content: "<h2>Welcome to our team workspace</h2><p>This guide will help you navigate and use all the features available.</p><ul><li>Explore departments and team members</li><li>Browse and create documentation</li><li>Use databases to track goals, projects, and tasks</li></ul><div class=\"callout callout-info\"><p>Info: If you're new, start by visiting the <strong>People</strong> page to meet the team.</p></div>", parentId: null, visibility: "workspace", sharedWith: { departmentIds: [], memberIds: [] }, author: "Sarah Chen", createdAt: "2026-03-01", updatedAt: "2026-04-05", tags: ["onboarding", "guide"] },
  { id: "d2", title: "Engineering Standards", content: "<h2>Coding Standards</h2><p>Our coding standards and best practices for all engineering projects.</p><h3>Code Reviews</h3><p>All pull requests require <strong>at least two approvals</strong> before merging.</p><div class=\"callout callout-warning\"><p>Warning: Never push directly to the main branch.</p></div>", parentId: null, visibility: "departments", sharedWith: { departmentIds: ["eng"], memberIds: [] }, author: "Jordan Park", createdAt: "2026-03-10", updatedAt: "2026-04-02", tags: ["engineering", "standards"] },
  { id: "d3", title: "Brand Guidelines", content: "<h2>Brand Identity</h2><p>Official brand colors, typography, and usage guidelines.</p><h3>Colors</h3><p>Primary: <mark style=\"background-color: #bfdbfe\">Blue (#2563eb)</mark>, Accent: <mark style=\"background-color: #e9d5ff\">Purple (#9333ea)</mark></p>", parentId: null, visibility: "departments", sharedWith: { departmentIds: ["design"], memberIds: [] }, author: "Alex Rivera", createdAt: "2026-03-15", updatedAt: "2026-04-01", tags: ["brand", "design"] },
  { id: "d4", title: "API Documentation", content: "<h2>API Reference</h2><p>Complete API reference for our public and internal endpoints.</p><pre><code>GET /api/v1/users\nPOST /api/v1/users\nGET /api/v1/projects/:id</code></pre><div class=\"callout callout-success\"><p>Success: All endpoints support JSON responses.</p></div>", parentId: "d2", visibility: "departments", sharedWith: { departmentIds: ["eng"], memberIds: [] }, author: "Jordan Park", createdAt: "2026-03-20", updatedAt: "2026-04-03", tags: ["api", "engineering"] },
  { id: "d5", title: "Product Roadmap", content: "<h2>Product Vision</h2><p>Our product vision and upcoming features for the next two quarters.</p><h3>Q2 Priorities</h3><ol><li>Mobile app v2 launch</li><li>User retention improvements</li><li>New analytics dashboard</li></ol>", parentId: null, visibility: "departments", sharedWith: { departmentIds: ["product"], memberIds: [] }, author: "Maria Santos", createdAt: "2026-03-25", updatedAt: "2026-04-04", tags: ["roadmap", "product"] },
];

// ---- Database Templates ----

export const databaseTemplates: { id: string; title: string; description: string; icon: string; columns: DatabaseColumn[] }[] = [
  {
    id: "goals", title: "Goals Tracker", description: "Track OKRs and goals with progress", icon: "Target",
    columns: [
      { id: "title", name: "Title", type: "text", required: true },
      { id: "status", name: "Status", type: "select", options: ["Not Started", "In Progress", "Completed", "Blocked"] },
      { id: "priority", name: "Priority", type: "select", options: ["Low", "Medium", "High", "Urgent"] },
      { id: "progress", name: "Progress", type: "progress" },
      { id: "assignee", name: "Assignee", type: "person" },
      { id: "due_date", name: "Due Date", type: "date" },
    ],
  },
  {
    id: "projects", title: "Project Board", description: "Manage projects with status and timeline", icon: "FolderKanban",
    columns: [
      { id: "title", name: "Title", type: "text", required: true },
      { id: "status", name: "Status", type: "select", options: ["Not Started", "In Progress", "Completed", "Blocked"] },
      { id: "priority", name: "Priority", type: "select", options: ["Low", "Medium", "High", "Urgent"] },
      { id: "assignee", name: "Assignee", type: "person" },
      { id: "due_date", name: "Due Date", type: "date" },
      { id: "tags", name: "Tags", type: "multi_select", options: ["Frontend", "Backend", "Design", "DevOps", "Mobile"] },
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
    id: "bugs", title: "Bug Tracker", description: "Track and resolve bugs", icon: "Bug",
    columns: [
      { id: "title", name: "Title", type: "text", required: true },
      { id: "severity", name: "Severity", type: "select", options: ["Critical", "High", "Medium", "Low"] },
      { id: "status", name: "Status", type: "select", options: ["Open", "Investigating", "Fixed", "Closed"] },
      { id: "reporter", name: "Reporter", type: "person" },
      { id: "assignee", name: "Assignee", type: "person" },
    ],
  },
  {
    id: "content", title: "Content Calendar", description: "Plan and schedule content", icon: "Calendar",
    columns: [
      { id: "title", name: "Title", type: "text", required: true },
      { id: "publish_date", name: "Publish Date", type: "date" },
      { id: "status", name: "Status", type: "select", options: ["Draft", "In Review", "Approved", "Published"] },
      { id: "author", name: "Author", type: "person" },
      { id: "channel", name: "Channel", type: "select", options: ["Blog", "Social", "Email", "Newsletter"] },
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
    id: "db1", title: "Company Goals", description: "Q2 2026 OKRs and strategic goals", icon: "Target",
    visibility: "workspace", sharedWith: { departmentIds: [], memberIds: [] }, createdBy: "Sarah Chen",
    columns: databaseTemplates[0].columns,
  },
  {
    id: "db2", title: "Engineering Projects", description: "Active engineering projects", icon: "FolderKanban",
    visibility: "departments", sharedWith: { departmentIds: ["eng"], memberIds: [] }, createdBy: "Jordan Park",
    columns: databaseTemplates[1].columns,
  },
  {
    id: "db3", title: "Sprint Tasks", description: "Current sprint task board", icon: "CheckSquare",
    visibility: "departments", sharedWith: { departmentIds: ["eng"], memberIds: [] }, createdBy: "Jordan Park",
    columns: databaseTemplates[2].columns,
  },
];

export const databaseRows: DatabaseRow[] = [
  // Company Goals rows
  { id: "r1", databaseId: "db1", values: { title: "Increase user retention by 20%", status: "In Progress", priority: "High", progress: 35, assignee: "Sarah Chen", due_date: "2026-06-30" }, createdAt: "2026-03-01", updatedAt: "2026-04-08" },
  { id: "r2", databaseId: "db1", values: { title: "Launch mobile app v2", status: "In Progress", priority: "Urgent", progress: 60, assignee: "Jordan Park", due_date: "2026-05-15" }, createdAt: "2026-03-01", updatedAt: "2026-04-07" },
  { id: "r3", databaseId: "db1", values: { title: "Rebrand marketing site", status: "Not Started", priority: "Medium", progress: 0, assignee: "Alex Rivera", due_date: "2026-07-01" }, createdAt: "2026-03-05", updatedAt: "2026-04-06" },

  // Engineering Projects rows
  { id: "r4", databaseId: "db2", values: { title: "Onboarding flow redesign", status: "In Progress", priority: "High", assignee: "Alex Rivera", due_date: "2026-05-01", tags: ["Frontend", "Design"] }, createdAt: "2026-03-10", updatedAt: "2026-04-05" },
  { id: "r5", databaseId: "db2", values: { title: "Push notification system", status: "In Progress", priority: "High", assignee: "Jordan Park", due_date: "2026-04-28", tags: ["Backend", "Mobile"] }, createdAt: "2026-03-12", updatedAt: "2026-04-04" },
  { id: "r6", databaseId: "db2", values: { title: "Performance audit", status: "Not Started", priority: "Urgent", assignee: "Jordan Park", due_date: "2026-04-14", tags: ["DevOps"] }, createdAt: "2026-03-15", updatedAt: "2026-04-03" },

  // Sprint Tasks rows
  { id: "r7", databaseId: "db3", values: { title: "Design new onboarding screens", status: "In Progress", priority: "High", assignee: "Alex Rivera", due_date: "2026-04-15" }, createdAt: "2026-04-01", updatedAt: "2026-04-08" },
  { id: "r8", databaseId: "db3", values: { title: "Implement FCM integration", status: "Done", priority: "High", assignee: "Jordan Park", due_date: "2026-04-10" }, createdAt: "2026-04-01", updatedAt: "2026-04-09" },
  { id: "r9", databaseId: "db3", values: { title: "Write API tests for notifications", status: "In Progress", priority: "Medium", assignee: "Dev Patel", due_date: "2026-04-12" }, createdAt: "2026-04-02", updatedAt: "2026-04-08" },
  { id: "r10", databaseId: "db3", values: { title: "Create email templates", status: "To Do", priority: "Low", assignee: "Maria Santos", due_date: "2026-04-20" }, createdAt: "2026-04-03", updatedAt: "2026-04-07" },
];

export const teamMembers: TeamMember[] = [
  { id: "m1", name: "Sarah Chen", email: "sarah@company.com", role: "Head of Product", departmentId: "product", avatar: null, joinedAt: "2024-01-15" },
  { id: "m2", name: "Jordan Park", email: "jordan@company.com", role: "Lead Engineer", departmentId: "eng", avatar: null, joinedAt: "2024-02-01" },
  { id: "m3", name: "Alex Rivera", email: "alex@company.com", role: "Design Lead", departmentId: "design", avatar: null, joinedAt: "2024-03-10" },
  { id: "m4", name: "Maria Santos", email: "maria@company.com", role: "Marketing Manager", departmentId: "marketing", avatar: null, joinedAt: "2024-04-05" },
  { id: "m5", name: "Dev Patel", email: "dev@company.com", role: "Senior Engineer", departmentId: "eng", avatar: null, joinedAt: "2024-05-20" },
  { id: "m6", name: "Lisa Kim", email: "lisa@company.com", role: "UX Designer", departmentId: "design", avatar: null, joinedAt: "2024-06-01" },
  { id: "m7", name: "Tom Wilson", email: "tom@company.com", role: "Operations Lead", departmentId: "ops", avatar: null, joinedAt: "2024-03-15" },
  { id: "m8", name: "Emma Davis", email: "emma@company.com", role: "Content Strategist", departmentId: "marketing", avatar: null, joinedAt: "2024-07-10" },
  { id: "m9", name: "Ryan Hughes", email: "ryan@company.com", role: "Frontend Engineer", departmentId: "eng", avatar: null, joinedAt: "2024-08-01" },
  { id: "m10", name: "Nina Zhao", email: "nina@company.com", role: "Product Designer", departmentId: "design", avatar: null, joinedAt: "2024-09-15" },
];
