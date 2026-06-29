// StatusPill — the ONE control the entire app uses for entity status.
//
// Usage:  <StatusPill kind="deal" value={deal.status} />                          (read-only)
//         <StatusPill kind="task" value={task.status} onChange={setStatus} />     (editable dropdown)
//
// All status values across goals / projects / tasks / deals / leads /
// transactions / issues / contacts route through one registry so a
// "Won" deal looks identical to a "Done" task looks identical to a
// "Completed" project — same tone, same shape, same density.
//
// Visual: soft pastel background (~15% saturation), no dot (dropped per
// feedback — redundant with the color fill itself, and made the chip read
// as a pill even at rounded-md). Default radius is `rounded` (4px) — a
// "curvy rectangle" rather than a pill; pass `shape="pill"` for contexts
// that want the fuller rounded-full treatment (mixing both shapes
// deliberately is fine, per feedback — just not by accident everywhere).
// When `onChange` is passed it becomes a dropdown trigger with a chevron,
// so status can be edited inline anywhere this renders.

import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveStatusTone, listStatusOptions, type EntityKind } from "@/lib/statusTone";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

export interface StatusPillProps {
  kind: EntityKind;
  value: string | null | undefined;
  /** Override the displayed label (defaults to the registry label). */
  label?: string;
  /** Smaller variant for dense lists. */
  size?: "sm" | "md";
  /** Show the colored dot prefix. Off by default — see note above. */
  showDot?: boolean;
  /** "rect" (default) — curvy rectangle, rounded (4px). "pill" — rounded-full. */
  shape?: "rect" | "pill";
  /** Pass to make this an editable dropdown instead of a static pill. */
  onChange?: (value: string) => void;
  className?: string;
}

export function StatusPill({
  kind, value, label, size = "md", showDot = false, shape = "rect", onChange, className,
}: StatusPillProps) {
  if (!value && !onChange) return null;
  const { hsl, label: registryLabel } = value
    ? resolveStatusTone(kind, value)
    : { hsl: "220 12% 55%", label: "Set status" };
  const display = label ?? registryLabel;

  const sizeClasses = size === "sm" ? "px-2 py-1 text-[10px]" : "px-2.5 py-1.5 text-[11px]";
  const dotSize = size === "sm" ? 5 : 6;

  const pill = (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-medium whitespace-nowrap",
        shape === "pill" ? "rounded-full" : "rounded",
        sizeClasses,
        onChange && "cursor-pointer hover:brightness-95 transition-[filter]",
        className,
      )}
      style={{
        backgroundColor: `hsl(${hsl} / 0.13)`,
        color: `hsl(${hsl})`,
      }}
    >
      {showDot && (
        <span
          className="inline-block rounded-full shrink-0"
          style={{ width: dotSize, height: dotSize, backgroundColor: `hsl(${hsl})` }}
        />
      )}
      <span className="capitalize leading-none">{display}</span>
      {onChange && <ChevronDown className="h-3 w-3 shrink-0 opacity-70" />}
    </span>
  );

  if (!onChange) return pill;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button">{pill}</button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {listStatusOptions(kind).map((opt) => (
          <DropdownMenuItem key={opt.value} onClick={() => onChange(opt.value)} className="justify-between">
            <span className="flex items-center gap-2">
              <span className="inline-block rounded-full shrink-0" style={{ width: 6, height: 6, backgroundColor: `hsl(${opt.hsl})` }} />
              {opt.label}
            </span>
            {value === opt.value && <Check className="h-3.5 w-3.5" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
