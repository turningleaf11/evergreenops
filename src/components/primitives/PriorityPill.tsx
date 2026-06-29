// PriorityPill — separate from StatusPill because priority is semantic
// (urgent / high / medium / low) and lives on its own scale.
// Same shape/density language as StatusPill: rounded (4px, "curvy
// rectangle") by default, no dot — status used to own the dot but no
// longer renders one either (feedback: redundant with the color fill).
// Pass `shape="pill"` for contexts that want rounded-full instead, and
// `onChange` to make it an editable dropdown.

import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolvePriorityTone, listPriorityOptions } from "@/lib/statusTone";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

export interface PriorityPillProps {
  value: string | null | undefined;
  size?: "sm" | "md";
  shape?: "rect" | "pill";
  onChange?: (value: string) => void;
  className?: string;
}

export function PriorityPill({ value, size = "md", shape = "rect", onChange, className }: PriorityPillProps) {
  if (!value && !onChange) return null;
  const { hsl, label } = value ? resolvePriorityTone(value) : { hsl: "220 12% 55%", label: "Set priority" };
  const sizeClasses = size === "sm" ? "px-2 py-1 text-[10px]" : "px-2.5 py-1.5 text-[11px]";

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
      <span className="capitalize leading-none">{label}</span>
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
        {listPriorityOptions().map((opt) => (
          <DropdownMenuItem key={opt.value} onClick={() => onChange(opt.value)} className="justify-between">
            {opt.label}
            {value === opt.value && <Check className="h-3.5 w-3.5" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
