export const WIKI_STATUSES = ["draft", "review", "needs_update", "active", "deprecated", "archived"] as const;
export type WikiStatus = (typeof WIKI_STATUSES)[number];

export const WIKI_STATUS_META: Record<WikiStatus, { label: string; className: string }> = {
  draft:        { label: "Draft",        className: "bg-muted text-muted-foreground" },
  review:       { label: "In Review",    className: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  needs_update: { label: "Needs Update", className: "bg-orange-500/15 text-orange-700 dark:text-orange-300" },
  active:       { label: "Active",       className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  deprecated:   { label: "Deprecated",   className: "bg-red-500/15 text-red-700 dark:text-red-300" },
  archived:     { label: "Archived",     className: "bg-muted/60 text-muted-foreground/80 line-through" },
};
