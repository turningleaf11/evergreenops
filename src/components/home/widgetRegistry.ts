export interface WidgetConfig {
  id: string;
  visible: boolean;
  sort_order: number;
}

export const WIDGET_REGISTRY = [
  { id: "time_clock", label: "Time Clock", description: "Clock in/out widget" },
  { id: "announcements", label: "Pinned Announcements", description: "Important pinned messages" },
  { id: "departments", label: "Departments", description: "Quick access to department hubs" },
  { id: "forms", label: "Forms & Requests", description: "Submit and track forms" },
  { id: "my_tasks", label: "My Tasks", description: "Tasks assigned to you" },
  { id: "quick_links", label: "Quick Links", description: "Your bookmarked shortcuts" },
  { id: "feed_preview", label: "Feed Preview", description: "Latest posts from the team" },
  { id: "reminders", label: "Reminders", description: "Your upcoming reminders" },
  { id: "recent_docs", label: "Recent Docs", description: "Recently updated documents" },
  { id: "activity_feed", label: "Activity Feed", description: "Workspace activity log" },
] as const;

export const DEFAULT_WIDGET_ORDER: WidgetConfig[] = WIDGET_REGISTRY.map((w, i) => ({
  id: w.id,
  visible: true,
  sort_order: i,
}));
