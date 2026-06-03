// PriorityPill — separate from StatusPill because priority is semantic
// (urgent / high / medium / low) and lives on its own scale.
// Same visual language: pastel background, no dot prefix (status owns the
// dot — keeps the two distinguishable at a glance).

import { cn } from "@/lib/utils";
import { resolvePriorityTone } from "@/lib/statusTone";

export interface PriorityPillProps {
  value: string | null | undefined;
  size?: "sm" | "md";
  className?: string;
}

export function PriorityPill({ value, size = "md", className }: PriorityPillProps) {
  if (!value) return null;
  const { hsl, label } = resolvePriorityTone(value);

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium whitespace-nowrap",
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-0.5 text-[11px]",
        className,
      )}
      style={{
        backgroundColor: `hsl(${hsl} / 0.13)`,
        color: `hsl(${hsl})`,
      }}
    >
      <span className="capitalize leading-none">{label}</span>
    </span>
  );
}
