import { Check, X, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";

export type BuyBoxFit = "yes" | "maybe" | "no" | "unchecked";

export const BUY_BOX_META: Record<
  BuyBoxFit,
  { label: string; border: string; bg: string; ring: string; icon: any }
> = {
  yes: {
    label: "Fits Buy Box",
    border: "border-l-emerald-500",
    bg: "bg-emerald-500 text-white hover:bg-emerald-600",
    ring: "ring-emerald-500/40",
    icon: Check,
  },
  maybe: {
    label: "Maybe",
    border: "border-l-amber-400",
    bg: "bg-amber-400 text-amber-950 hover:bg-amber-500",
    ring: "ring-amber-400/40",
    icon: HelpCircle,
  },
  no: {
    label: "Pass",
    border: "border-l-red-500",
    bg: "bg-red-500 text-white hover:bg-red-600",
    ring: "ring-red-500/40",
    icon: X,
  },
  unchecked: {
    label: "Unchecked",
    border: "border-l-muted-foreground/30",
    bg: "bg-muted text-foreground",
    ring: "ring-muted-foreground/20",
    icon: HelpCircle,
  },
};

export function BuyBoxButtons({
  value,
  reason,
  onChange,
  onReasonChange,
}: {
  value: BuyBoxFit;
  reason: string | null;
  onChange: (v: BuyBoxFit) => void;
  onReasonChange: (v: string | null) => void;
}) {
  const choices: { v: BuyBoxFit; label: string; icon: any }[] = [
    { v: "yes", label: "Fits Buy Box", icon: Check },
    { v: "maybe", label: "Maybe", icon: HelpCircle },
    { v: "no", label: "Pass", icon: X },
  ];
  return (
    <div className="space-y-3">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Buy Box Check
      </div>
      <div className="grid grid-cols-3 gap-2">
        {choices.map((c) => {
          const meta = BUY_BOX_META[c.v];
          const active = value === c.v;
          const Icon = c.icon;
          return (
            <button
              key={c.v}
              onClick={() => onChange(c.v)}
              className={cn(
                "flex items-center justify-center gap-1.5 h-11 rounded-lg text-sm font-medium transition-all border border-transparent",
                active
                  ? `${meta.bg} ring-2 ring-offset-1 ring-offset-background ${meta.ring}`
                  : "bg-muted/40 text-muted-foreground hover:bg-muted",
              )}
            >
              <Icon className="h-4 w-4" />
              {c.label}
            </button>
          );
        })}
      </div>
      {value === "no" && (
        <div className="space-y-1">
          <label className="text-[11px] text-muted-foreground">Reason for pass</label>
          <Textarea
            value={reason ?? ""}
            onChange={(e) => onReasonChange(e.target.value || null)}
            placeholder="Why does this not fit?"
            rows={2}
            className="text-sm"
          />
        </div>
      )}
    </div>
  );
}
