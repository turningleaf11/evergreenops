// StatusPill — the ONE pill the entire app uses for entity status.
//
// Usage:  <StatusPill kind="deal" value={deal.status} />
//         <StatusPill kind="task" value="in_progress" />
//
// All status values across goals / projects / tasks / deals / leads /
// transactions / issues / contacts route through one registry so a
// "Won" deal looks identical to a "Done" task looks identical to a
// "Completed" project — same tone, same shape, same density.
//
// Visual: soft pastel background (~15% saturation), colored dot prefix,
// rounded-full, ~10px text. Matches the references the user picked.

import { cn } from "@/lib/utils";
import { resolveStatusTone, type EntityKind } from "@/lib/statusTone";

export interface StatusPillProps {
  kind: EntityKind;
  value: string | null | undefined;
  /** Override the displayed label (defaults to the registry label). */
  label?: string;
  /** Smaller variant for dense lists. */
  size?: "sm" | "md";
  /** Hide the colored dot prefix (rare — usually keep it). */
  hideDot?: boolean;
  className?: string;
}

export function StatusPill({
  kind, value, label, size = "md", hideDot = false, className,
}: StatusPillProps) {
  if (!value) return null;
  const { hsl, label: registryLabel } = resolveStatusTone(kind, value);
  const display = label ?? registryLabel;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap",
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-0.5 text-[11px]",
        className,
      )}
      style={{
        backgroundColor: `hsl(${hsl} / 0.13)`,
        color: `hsl(${hsl})`,
      }}
    >
      {!hideDot && (
        <span
          className="inline-block rounded-full shrink-0"
          style={{
            width: size === "sm" ? 5 : 6,
            height: size === "sm" ? 5 : 6,
            backgroundColor: `hsl(${hsl})`,
          }}
        />
      )}
      <span className="capitalize leading-none">{display}</span>
    </span>
  );
}
