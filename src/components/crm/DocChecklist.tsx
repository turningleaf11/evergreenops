import { FileCheck2, AlertTriangle, Check } from "lucide-react";
import { differenceInCalendarDays } from "date-fns";
import { cn } from "@/lib/utils";

type Doc = "om" | "t12" | "rent_roll";

const DOCS: { key: Doc; label: string; field: "has_om" | "has_t12" | "has_rent_roll" }[] = [
  { key: "om", label: "OM", field: "has_om" },
  { key: "t12", label: "T12", field: "has_t12" },
  { key: "rent_roll", label: "Rent Roll", field: "has_rent_roll" },
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
    <div className="space-y-3">
      <div className="flex items-center gap-2 crm-eyebrow">
        <FileCheck2 className="h-3.5 w-3.5" /> Documents
      </div>
      <div className="flex flex-wrap gap-2">
        {DOCS.map((d) => {
          const checked = map[d.key];
          return (
            <button
              key={d.key}
              onClick={() => onToggle(d.field, !checked)}
              className={cn(
                "inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all",
                checked
                  ? "bg-brand-mint text-white shadow-sm hover:brightness-95"
                  : "bg-muted text-muted-foreground hover:bg-muted/70",
              )}
            >
              {checked && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
              {d.label}
            </button>
          );
        })}
      </div>

      {showWarning && (
        <div className="rounded-xl border border-brand-tangerine/40 bg-brand-tangerine/10 px-4 py-3 flex items-center gap-2 text-sm text-foreground">
          <AlertTriangle className="h-4 w-4 shrink-0 text-brand-tangerine" />
          <span>
            Missing documents — follow up with{" "}
            <strong>{sourceContactName || "the source contact"}</strong>.
          </span>
        </div>
      )}
    </div>
  );
}
