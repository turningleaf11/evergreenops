import { cn } from "@/lib/utils";

// ── Semantic status/priority badge system ─────────────────────
// Uses CSS vars so it works correctly in both light and dark mode.
// Never use raw Tailwind color classes (bg-red-100, text-yellow-800, etc.)
// — those break in dark mode. Always use this component instead.

type BadgeVariant =
  | "default"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "muted"
  | "primary"
  | "purple"
  | "mint"
  | "coral";

const VARIANT_CLS: Record<BadgeVariant, string> = {
  default:  "bg-muted/60 text-muted-foreground border-border/30",
  muted:    "bg-muted/40 text-muted-foreground/70 border-border/20",
  primary:  "bg-primary/10 text-primary border-primary/20",
  success:  "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
  warning:  "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
  danger:   "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
  info:     "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
  purple:   "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20",
  mint:     "bg-[hsl(var(--brand-mint)/0.12)] text-[hsl(var(--brand-mint-deep))] border-[hsl(var(--brand-mint)/0.25)]",
  coral:    "bg-[hsl(var(--brand-coral)/0.10)] text-[hsl(var(--brand-coral))] border-[hsl(var(--brand-coral)/0.20)]",
};

// ── Common status → variant maps ──────────────────────────────

export const TASK_STATUS_VARIANT: Record<string, BadgeVariant> = {
  todo:        "muted",
  not_started: "muted",
  in_progress: "info",
  on_track:    "success",
  behind:      "warning",
  at_risk:     "danger",
  blocked:     "danger",
  done:        "success",
  not_done:    "muted",
  completed:   "success",
};

export const PRIORITY_VARIANT: Record<string, BadgeVariant> = {
  urgent: "danger",
  high:   "danger",
  "1":    "danger",
  medium: "warning",
  "2":    "warning",
  low:    "success",
  "3":    "success",
};

export const PRIORITY_LABEL: Record<string, string> = {
  urgent: "Urgent",
  high: "High", "1": "High",
  medium: "Medium", "2": "Medium",
  low: "Low", "3": "Low",
};

export const GOAL_STATUS_VARIANT: Record<string, BadgeVariant> = {
  on_track:    "success",
  behind:      "warning",
  at_risk:     "danger",
  done:        "success",
  not_done:    "muted",
  not_started: "muted",
};

export const GOAL_STATUS_LABEL: Record<string, string> = {
  on_track: "On Track", behind: "Behind", at_risk: "At Risk",
  done: "Done", not_done: "Not Done", not_started: "Not Started",
};

export const PROJECT_STATUS_VARIANT: Record<string, BadgeVariant> = {
  not_started: "muted",
  in_progress: "info",
  done:        "success",
  blocked:     "danger",
};

export const PROJECT_STATUS_LABEL: Record<string, string> = {
  not_started: "Not Started", in_progress: "In Progress",
  done: "Done", blocked: "Blocked",
};

export const PROCESS_NODE_VARIANT: Record<string, BadgeVariant> = {
  source:   "success",
  process:  "info",
  decision: "warning",
  outcome:  "purple",
};

export const IMPROVEMENT_KIND_VARIANT: Record<string, BadgeVariant> = {
  idea:        "purple",
  pain_point:  "danger",
  observation: "info",
  improvement: "success",
};

// ── Component ─────────────────────────────────────────────────

interface StatusBadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: "xs" | "sm";
  dot?: boolean;
  className?: string;
  icon?: React.ReactNode;
}

export function StatusBadge({
  label,
  variant = "default",
  size = "sm",
  dot = false,
  className,
  icon,
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border font-medium leading-none",
        size === "xs" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs",
        VARIANT_CLS[variant],
        className
      )}
    >
      {dot && (
        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70 shrink-0" />
      )}
      {icon && <span className="shrink-0">{icon}</span>}
      {label}
    </span>
  );
}
