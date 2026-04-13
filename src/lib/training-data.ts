export type TrainingModuleType = "guide" | "playbook" | "checklist" | "video" | "link";
export type TrainingCategory = "Onboarding" | "Role Training" | "Processes" | "Tools";

export interface TrainingStep {
  id: string;
  title: string;
  content?: string; // HTML or markdown-style content
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
  roleIds: string[]; // empty = visible to all
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
    title: "Welcome to TeamSpace",
    description: "Get familiar with the platform and how your team collaborates.",
  },
  {
    id: "meet-team",
    title: "Meet the team",
    description: "Browse the People directory to see who you'll be working with.",
    link: "/people",
    linkLabel: "View People",
  },
  {
    id: "explore-dept",
    title: "Explore your department",
    description: "Check out your department page to see current projects and priorities.",
    link: "/department/engineering",
    linkLabel: "Go to Departments",
  },
  {
    id: "review-docs",
    title: "Review key docs",
    description: "Read through important documentation to understand processes and guidelines.",
    link: "/docs",
    linkLabel: "Open Docs",
  },
  {
    id: "complete-training",
    title: "Complete role training",
    description: "Finish your role-specific training modules to get fully up to speed.",
    link: "/training",
    linkLabel: "Start Training",
  },
];

export const trainingModules: TrainingModule[] = [
  // Onboarding — visible to all
  {
    id: "company-overview",
    title: "Company Overview",
    description: "Understand our mission, values, and how we operate as an organization.",
    type: "guide",
    category: "Onboarding",
    roleIds: [],
    steps: [
      { id: "co-1", title: "Our Mission & Vision", content: "We build tools that empower teams to move faster with more clarity. Our vision is a world where every organization operates with transparency and aligned execution." },
      { id: "co-2", title: "Core Values", content: "1. Clarity over complexity\n2. Ownership at every level\n3. Speed with intention\n4. Trust through transparency" },
      { id: "co-3", title: "How We Work", content: "We operate in a structured strategy cascade: CEO sets direction, leadership translates strategy, and teams execute with accountability. Every decision flows through our Strategy system." },
    ],
  },
  {
    id: "platform-basics",
    title: "Platform Basics",
    description: "Learn how to navigate TeamSpace and use core features.",
    type: "playbook",
    category: "Onboarding",
    roleIds: [],
    steps: [
      { id: "pb-1", title: "Navigation & Sidebar", content: "The sidebar gives you access to all core areas: Home, Docs, Databases, People, and Training. Department and database sub-sections expand for quick access." },
      { id: "pb-2", title: "Documents", content: "Create and edit documents with our block-based editor. Use slash commands (/) to insert headings, lists, callouts, and more." },
      { id: "pb-3", title: "Databases", content: "Databases are structured tables for tracking work. Each database has custom columns and views. Use them for projects, tasks, bugs, and more." },
      { id: "pb-4", title: "Strategy Flow", content: "Strategy items flow from CEO → Leadership → Operations. Watch for items assigned to your department in the Leadership dashboard." },
    ],
  },
  {
    id: "communication-guide",
    title: "Communication Guidelines",
    description: "How we communicate, give feedback, and make decisions.",
    type: "guide",
    category: "Processes",
    roleIds: [],
    steps: [
      { id: "cg-1", title: "Async-First Communication", content: "We default to async communication. Use documents for proposals, databases for tracking, and structured feedback forms for upward communication." },
      { id: "cg-2", title: "Decision-Making Process", content: "Decisions are logged in the Decision Log. Major decisions require leadership review. Use the Upward Proposal form to suggest changes to strategy." },
      { id: "cg-3", title: "Meeting Norms", content: "Meetings have agendas shared 24h in advance. Notes are captured in Docs. Action items go into the relevant database." },
    ],
  },
  // Role-specific training
  {
    id: "engineering-onboarding",
    title: "Engineering Onboarding",
    description: "Technical setup, coding standards, and development workflow.",
    type: "playbook",
    category: "Role Training",
    roleIds: ["engineering"],
    steps: [
      { id: "eo-1", title: "Dev Environment Setup", content: "1. Clone the repository\n2. Install dependencies\n3. Set up local environment variables\n4. Run the development server\n5. Verify tests pass" },
      { id: "eo-2", title: "Code Standards", content: "We use TypeScript, React, and Tailwind CSS. Follow the existing patterns in the codebase. All PRs require one approval." },
      { id: "eo-3", title: "Deployment Process", content: "We deploy via CI/CD. Merges to main trigger staging deploys. Production releases are tagged and require lead approval." },
    ],
  },
  {
    id: "design-onboarding",
    title: "Design Onboarding",
    description: "Design system, tools, and collaboration workflow.",
    type: "playbook",
    category: "Role Training",
    roleIds: ["design"],
    steps: [
      { id: "do-1", title: "Design System", content: "Our design system uses semantic tokens, consistent spacing, and a defined color palette. All components follow the system." },
      { id: "do-2", title: "Design Tools", content: "We use Figma for design work. Access the team workspace and review existing component libraries before starting new designs.", externalUrl: "https://figma.com", externalLabel: "Open Figma" },
      { id: "do-3", title: "Handoff Process", content: "Designs are handed off via Figma with annotations. Developers reference the design system tokens for implementation." },
    ],
  },
  {
    id: "marketing-onboarding",
    title: "Marketing Onboarding",
    description: "Brand guidelines, campaigns, and analytics.",
    type: "playbook",
    category: "Role Training",
    roleIds: ["marketing"],
    steps: [
      { id: "mo-1", title: "Brand Guidelines", content: "Our brand voice is clear, confident, and helpful. Review the brand deck for logo usage, color palette, and tone guidelines." },
      { id: "mo-2", title: "Campaign Workflow", content: "Campaigns are tracked in the Marketing Projects database. Each campaign has a brief, timeline, and assigned owner." },
      { id: "mo-3", title: "Analytics & Reporting", content: "We track key metrics weekly. Reports are shared in the Marketing department docs.", externalUrl: "https://analytics.google.com", externalLabel: "Google Analytics" },
    ],
  },
  {
    id: "product-onboarding",
    title: "Product Onboarding",
    description: "Product strategy, roadmap management, and feature workflow.",
    type: "playbook",
    category: "Role Training",
    roleIds: ["product"],
    steps: [
      { id: "po-1", title: "Product Roadmap", content: "The roadmap is maintained in the Product Roadmap database. Items flow from strategy through to execution via the Strategy Flow system." },
      { id: "po-2", title: "Feature Lifecycle", content: "Ideas → Research → Spec → Design → Build → Ship → Measure. Each stage has clear exit criteria." },
      { id: "po-3", title: "User Research", content: "We conduct regular user interviews and surveys. Findings are documented in the Research section of Docs." },
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
      { id: "to-1", title: "TeamSpace (This Platform)", content: "Our central hub for docs, databases, strategy, and collaboration." },
      { id: "to-2", title: "Figma", content: "Design and prototyping tool.", externalUrl: "https://figma.com", externalLabel: "Open Figma" },
      { id: "to-3", title: "GitHub", content: "Code repository and version control.", externalUrl: "https://github.com", externalLabel: "Open GitHub" },
      { id: "to-4", title: "Slack", content: "Real-time messaging for quick discussions.", externalUrl: "https://slack.com", externalLabel: "Open Slack" },
    ],
  },
  // Video training
  {
    id: "strategy-system-video",
    title: "Strategy Flow Walkthrough",
    description: "Watch a video overview of how the Strategy Flow system works.",
    type: "video",
    category: "Processes",
    roleIds: [],
    steps: [
      { id: "sv-1", title: "Strategy Flow Overview", content: "This video walks through the full strategy cascade from CEO to operations.", videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ" },
    ],
  },
];
