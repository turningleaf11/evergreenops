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

export interface DocPage {
  id: string;
  title: string;
  content: string;
  parentId: string | null;
  departmentId: string | null;
  author: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
}

export interface DatabaseItem {
  id: string;
  title: string;
  type: "goal" | "project" | "task";
  status: "not_started" | "in_progress" | "completed" | "blocked";
  priority: "low" | "medium" | "high" | "urgent";
  assignee: string;
  departmentId: string;
  dueDate: string | null;
  progress: number;
  parentId: string | null;
  tags: string[];
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
  { id: "d1", title: "Getting Started Guide", content: "Welcome to our team workspace. This guide will help you navigate and use all the features available.", parentId: null, departmentId: null, author: "Sarah Chen", createdAt: "2026-03-01", updatedAt: "2026-04-05", tags: ["onboarding", "guide"] },
  { id: "d2", title: "Engineering Standards", content: "Our coding standards and best practices for all engineering projects.", parentId: null, departmentId: "eng", author: "Jordan Park", createdAt: "2026-03-10", updatedAt: "2026-04-02", tags: ["engineering", "standards"] },
  { id: "d3", title: "Brand Guidelines", content: "Official brand colors, typography, and usage guidelines.", parentId: null, departmentId: "design", author: "Alex Rivera", createdAt: "2026-03-15", updatedAt: "2026-04-01", tags: ["brand", "design"] },
  { id: "d4", title: "API Documentation", content: "Complete API reference for our public and internal endpoints.", parentId: "d2", departmentId: "eng", author: "Jordan Park", createdAt: "2026-03-20", updatedAt: "2026-04-03", tags: ["api", "engineering"] },
  { id: "d5", title: "Product Roadmap", content: "Our product vision and upcoming features for the next two quarters.", parentId: null, departmentId: "product", author: "Maria Santos", createdAt: "2026-03-25", updatedAt: "2026-04-04", tags: ["roadmap", "product"] },
];

export const databaseItems: DatabaseItem[] = [
  { id: "g1", title: "Increase user retention by 20%", type: "goal", status: "in_progress", priority: "high", assignee: "Sarah Chen", departmentId: "product", dueDate: "2026-06-30", progress: 35, parentId: null, tags: ["growth", "retention"] },
  { id: "g2", title: "Launch mobile app v2", type: "goal", status: "in_progress", priority: "urgent", assignee: "Jordan Park", departmentId: "eng", dueDate: "2026-05-15", progress: 60, parentId: null, tags: ["mobile", "launch"] },
  { id: "g3", title: "Rebrand marketing site", type: "goal", status: "not_started", priority: "medium", assignee: "Alex Rivera", departmentId: "design", dueDate: "2026-07-01", progress: 0, parentId: null, tags: ["brand", "website"] },
  { id: "p1", title: "Onboarding flow redesign", type: "project", status: "in_progress", priority: "high", assignee: "Alex Rivera", departmentId: "design", dueDate: "2026-05-01", progress: 45, parentId: "g1", tags: ["ux", "onboarding"] },
  { id: "p2", title: "Push notification system", type: "project", status: "in_progress", priority: "high", assignee: "Jordan Park", departmentId: "eng", dueDate: "2026-04-28", progress: 70, parentId: "g2", tags: ["notifications", "mobile"] },
  { id: "p3", title: "Content strategy Q2", type: "project", status: "not_started", priority: "medium", assignee: "Maria Santos", departmentId: "marketing", dueDate: "2026-05-15", progress: 0, parentId: null, tags: ["content", "strategy"] },
  { id: "t1", title: "Design new onboarding screens", type: "task", status: "in_progress", priority: "high", assignee: "Alex Rivera", departmentId: "design", dueDate: "2026-04-15", progress: 60, parentId: "p1", tags: ["design", "ui"] },
  { id: "t2", title: "Implement FCM integration", type: "task", status: "completed", priority: "high", assignee: "Jordan Park", departmentId: "eng", dueDate: "2026-04-10", progress: 100, parentId: "p2", tags: ["backend", "firebase"] },
  { id: "t3", title: "Write API tests for notifications", type: "task", status: "in_progress", priority: "medium", assignee: "Dev Patel", departmentId: "eng", dueDate: "2026-04-12", progress: 30, parentId: "p2", tags: ["testing", "api"] },
  { id: "t4", title: "Create email templates", type: "task", status: "not_started", priority: "low", assignee: "Maria Santos", departmentId: "marketing", dueDate: "2026-04-20", progress: 0, parentId: "p3", tags: ["email", "design"] },
  { id: "t5", title: "User research interviews", type: "task", status: "blocked", priority: "medium", assignee: "Sarah Chen", departmentId: "product", dueDate: "2026-04-18", progress: 10, parentId: "p1", tags: ["research", "ux"] },
  { id: "t6", title: "Performance audit", type: "task", status: "not_started", priority: "urgent", assignee: "Jordan Park", departmentId: "eng", dueDate: "2026-04-14", progress: 0, parentId: null, tags: ["performance", "devops"] },
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

export const statusConfig = {
  not_started: { label: "Not Started", color: "220 10% 46%" },
  in_progress: { label: "In Progress", color: "220 65% 48%" },
  completed: { label: "Completed", color: "142 71% 45%" },
  blocked: { label: "Blocked", color: "0 72% 51%" },
};

export const priorityConfig = {
  low: { label: "Low", color: "220 10% 46%" },
  medium: { label: "Medium", color: "38 92% 50%" },
  high: { label: "High", color: "25 95% 53%" },
  urgent: { label: "Urgent", color: "0 72% 51%" },
};
