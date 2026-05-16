import { SyncTag } from "@/hooks/useSync";
import { cn } from "@/lib/utils";

const colorClasses: Record<string, string> = {
  blue:   "bg-blue-500/10 text-blue-700 dark:text-blue-300 ring-blue-500/20",
  orange: "bg-orange-500/10 text-orange-700 dark:text-orange-300 ring-orange-500/20",
  purple: "bg-purple-500/10 text-purple-700 dark:text-purple-300 ring-purple-500/20",
  red:    "bg-red-500/10 text-red-700 dark:text-red-300 ring-red-500/20",
  green:  "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-emerald-500/20",
  gray:   "bg-muted text-muted-foreground ring-border/40",
};

export function SyncTagBadge({ tag, size = "sm" }: { tag: SyncTag; size?: "sm" | "xs" }) {
  const cls = colorClasses[tag.color] ?? colorClasses.gray;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full ring-1",
        size === "xs" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]",
        cls,
      )}
    >
      <span aria-hidden>{tag.emoji}</span>
      <span className="font-medium">{tag.label}</span>
    </span>
  );
}
