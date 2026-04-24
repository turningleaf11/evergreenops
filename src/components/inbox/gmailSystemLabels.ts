import {
  Star,
  Circle,
  AlertCircle,
  HelpCircle,
  Info,
  CheckCircle2,
  ChevronsRight,
  Tag,
  Bell,
  User,
  Users,
  MessageSquare,
  type LucideIcon,
} from "lucide-react";

export type SystemLabelGroup = "categories" | "stars";

export interface SystemLabelMeta {
  displayName: string;
  icon: LucideIcon;
  color: string; // CSS color
  group: SystemLabelGroup;
  filled?: boolean; // when true, fill the icon with `color`
}

// Tailwind-ish hex palette so icons read well on light + dark backgrounds.
const PALETTE = {
  yellow: "#facc15",
  red: "#ef4444",
  orange: "#f97316",
  blue: "#3b82f6",
  green: "#22c55e",
  purple: "#a855f7",
  amber: "#f59e0b",
  indigo: "#6366f1",
};

export const SYSTEM_LABEL_META: Record<string, SystemLabelMeta> = {
  // Importance
  IMPORTANT: { displayName: "Important", icon: Tag, color: PALETTE.amber, group: "stars", filled: true },

  // Categories (Gmail tabs)
  CATEGORY_PERSONAL: { displayName: "Personal", icon: User, color: PALETTE.indigo, group: "categories" },
  CATEGORY_SOCIAL: { displayName: "Social", icon: Users, color: PALETTE.blue, group: "categories" },
  CATEGORY_PROMOTIONS: { displayName: "Promotions", icon: Tag, color: PALETTE.green, group: "categories" },
  CATEGORY_UPDATES: { displayName: "Updates", icon: Bell, color: PALETTE.orange, group: "categories" },
  CATEGORY_FORUMS: { displayName: "Forums", icon: MessageSquare, color: PALETTE.purple, group: "categories" },

  // Stars (favorites with color variants)
  YELLOW_STAR: { displayName: "Yellow star", icon: Star, color: PALETTE.yellow, group: "stars", filled: true },
  RED_STAR: { displayName: "Red star", icon: Star, color: PALETTE.red, group: "stars", filled: true },
  ORANGE_STAR: { displayName: "Orange star", icon: Star, color: PALETTE.orange, group: "stars", filled: true },
  BLUE_STAR: { displayName: "Blue star", icon: Star, color: PALETTE.blue, group: "stars", filled: true },
  GREEN_STAR: { displayName: "Green star", icon: Star, color: PALETTE.green, group: "stars", filled: true },
  PURPLE_STAR: { displayName: "Purple star", icon: Star, color: PALETTE.purple, group: "stars", filled: true },

  // Bubbles
  YELLOW_BUBBLE: { displayName: "Yellow bubble", icon: Circle, color: PALETTE.yellow, group: "stars", filled: true },
  RED_BUBBLE: { displayName: "Red bubble", icon: Circle, color: PALETTE.red, group: "stars", filled: true },
  ORANGE_BUBBLE: { displayName: "Orange bubble", icon: Circle, color: PALETTE.orange, group: "stars", filled: true },
  BLUE_BUBBLE: { displayName: "Blue bubble", icon: Circle, color: PALETTE.blue, group: "stars", filled: true },
  GREEN_BUBBLE: { displayName: "Green bubble", icon: Circle, color: PALETTE.green, group: "stars", filled: true },
  PURPLE_BUBBLE: { displayName: "Purple bubble", icon: Circle, color: PALETTE.purple, group: "stars", filled: true },

  // Flags / markers
  RED_BANG: { displayName: "Red flag", icon: AlertCircle, color: PALETTE.red, group: "stars" },
  YELLOW_BANG: { displayName: "Yellow flag", icon: AlertCircle, color: PALETTE.yellow, group: "stars" },
  ORANGE_GUILLEMET: { displayName: "Orange forwarded", icon: ChevronsRight, color: PALETTE.orange, group: "stars" },
  PURPLE_QUESTION: { displayName: "Question", icon: HelpCircle, color: PALETTE.purple, group: "stars" },
  BLUE_INFO: { displayName: "Info", icon: Info, color: PALETTE.blue, group: "stars" },
  GREEN_CHECK: { displayName: "Check", icon: CheckCircle2, color: PALETTE.green, group: "stars" },
  PURPLE_GUILLEMET: { displayName: "Forwarded", icon: ChevronsRight, color: PALETTE.purple, group: "stars" },
};

export function getSystemLabelMeta(id: string): SystemLabelMeta | null {
  return SYSTEM_LABEL_META[id] ?? null;
}

export const SYSTEM_GROUP_LABELS: Record<SystemLabelGroup, string> = {
  categories: "Categories",
  stars: "Stars & flags",
};
