export interface WidgetConfig {
  id: string;
  visible: boolean;
  sort_order: number;
  column: "left" | "right";
}

export const WIDGET_REGISTRY = [
  // Left column — primary content
  { id: "inline_feed", label: "Company Feed", description: "Composer + latest posts inline on Home", defaultColumn: "left" as const },
  { id: "my_tasks", label: "My Tasks", description: "Tasks assigned to you", defaultColumn: "left" as const },
  { id: "reminders", label: "Reminders", description: "Your upcoming reminders", defaultColumn: "left" as const },
  { id: "recent_docs", label: "Recent Docs", description: "Recently updated documents", defaultColumn: "left" as const },
  { id: "feed_chat", label: "AI Chat", description: "Quick chat with the AI companion", defaultColumn: "left" as const },

  // Right column — people & culture
  { id: "recognition", label: "Recognition", description: "Recent kudos from teammates", defaultColumn: "right" as const },
  { id: "my_team", label: "My Team", description: "People in your department", defaultColumn: "right" as const },
  { id: "birthdays", label: "Celebrations", description: "Upcoming birthdays & work anniversaries", defaultColumn: "right" as const },
  { id: "announcements", label: "Pinned Announcements", description: "Important pinned messages", defaultColumn: "right" as const },
  { id: "departments", label: "Departments", description: "Quick access to department hubs", defaultColumn: "right" as const },
  { id: "forms", label: "Forms & Requests", description: "Submit and track forms", defaultColumn: "right" as const },
  { id: "activity_feed", label: "Activity Feed", description: "Workspace activity log", defaultColumn: "right" as const },
] as const;

export const DEFAULT_WIDGET_ORDER: WidgetConfig[] = WIDGET_REGISTRY.map((w, i) => ({
  id: w.id,
  visible: ["inline_feed", "my_tasks", "recognition", "my_team", "birthdays", "announcements"].includes(w.id),
  sort_order: i,
  column: w.defaultColumn,
}));
