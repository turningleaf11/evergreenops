// LaunchStep — one numbered, collapsible step in the Marketing launch sequence.
// Header shows the step number (turns mint when done), title, and a live status
// chip. Children stay MOUNTED when collapsed (hidden via CSS) so dialogs and
// status callbacks inside keep working.

import { useState, type ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type StepTone = "done" | "progress" | "todo" | "warn" | "danger";

const CHIP_TONE: Record<StepTone, string> = {
  done: "bg-brand-mint/15 text-brand-mint-deep",
  progress: "bg-brand-azure/10 text-brand-azure",
  todo: "bg-muted text-muted-foreground",
  warn: "bg-brand-tangerine/15 text-brand-tangerine",
  danger: "bg-brand-coral/15 text-brand-coral",
};

export function LaunchStep({
  n,
  title,
  subtitle,
  status,
  defaultOpen = false,
  children,
}: {
  n: number;
  title: string;
  subtitle?: string;
  status?: { label: string; tone: StepTone };
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const done = status?.tone === "done";

  return (
    <div className="crm-card !p-0 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3.5 px-5 py-4 text-left hover:bg-muted/30 transition-colors"
      >
        <span
          className={cn(
            "h-7 w-7 rounded-full grid place-items-center text-[13px] font-semibold shrink-0 transition-colors",
            done ? "bg-brand-mint text-white" : "border border-border text-muted-foreground",
          )}
        >
          {done ? <Check className="h-4 w-4" strokeWidth={3} /> : n}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-semibold leading-tight">{title}</span>
          {subtitle && (
            <span className="block text-xs text-muted-foreground leading-tight mt-0.5 truncate">{subtitle}</span>
          )}
        </span>
        {status && (
          <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap", CHIP_TONE[status.tone])}>
            {status.label}
          </span>
        )}
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground shrink-0 transition-transform", open && "rotate-180")} />
      </button>

      {/* Keep mounted; hide when collapsed. */}
      <div className={cn(!open && "hidden")}>
        <div className="border-t border-border/40 px-5 py-5">{children}</div>
      </div>
    </div>
  );
}

export default LaunchStep;
