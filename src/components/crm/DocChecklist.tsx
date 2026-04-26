import { FileCheck2, AlertTriangle } from "lucide-react";
import { differenceInCalendarDays } from "date-fns";
import { cn } from "@/lib/utils";

type Doc = "om" | "t12" | "rent_roll";

const DOCS: { key: Doc; label: string; field: "has_om" | "has_t12" | "has_rent_roll" }[] = [
  { key: "om", label: "OM Received", field: "has_om" },
  { key: "t12", label: "T12 Received", field: "has_t12" },
  { key: "rent_roll", label: "Rent Roll Received", field: "has_rent_roll" },
];

export function DocChecklist({
  hasOm,
  hasT12,
  hasRentRoll,
  createdAt,
  sourceContactName,
  onToggle,
}: {
  hasOm: boolean;
  hasT12: boolean;
  hasRentRoll: boolean;
  createdAt: string;
  sourceContactName?: string | null;
  onToggle: (field: "has_om" | "has_t12" | "has_rent_roll", value: boolean) => void;
}) {
  const map: Record<Doc, boolean> = { om: hasOm, t12: hasT12, rent_roll: hasRentRoll };
  const allComplete = hasOm && hasT12 && hasRentRoll;
  const days = differenceInCalendarDays(new Date(), new Date(createdAt));
  const showWarning = !allComplete && days > 3;

  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-border/50 bg-card px-3 py-2.5 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <FileCheck2 className="h-3.5 w-3.5" /> Documents
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {DOCS.map((d) => {
            const checked = map[d.key];
            return (
              <button
                key={d.key}
                onClick={() => onToggle(d.field, !checked)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs border transition-colors",
                  checked
                    ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
                    : "bg-background border-border hover:bg-muted text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "h-3.5 w-3.5 rounded-[3px] border flex items-center justify-center text-[10px] font-bold",
                    checked
                      ? "bg-emerald-500 border-emerald-500 text-white"
                      : "border-muted-foreground/40",
                  )}
                >
                  {checked ? "✓" : ""}
                </span>
                {d.label}
              </button>
            );
          })}
        </div>
      </div>

      {showWarning && (
        <div className="rounded-lg border border-amber-400/40 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 flex items-center gap-2 text-xs text-amber-800 dark:text-amber-200">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>
            Missing documents — follow up with{" "}
            <strong>{sourceContactName || "the source contact"}</strong>.
          </span>
        </div>
      )}
    </div>
  );
}
