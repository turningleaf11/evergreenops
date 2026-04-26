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
    border: "border-l-brand-mint",
    bg: "bg-brand-mint text-white hover:brightness-95",
    ring: "ring-brand-mint/40",
    icon: Check,
  },
  maybe: {
    label: "Maybe",
    border: "border-l-brand-tangerine",
    bg: "bg-brand-tangerine text-white hover:brightness-95",
    ring: "ring-brand-tangerine/40",
    icon: HelpCircle,
  },
  no: {
    label: "Pass",
    border: "border-l-brand-coral",
    bg: "bg-brand-coral text-white hover:brightness-95",
    ring: "ring-brand-coral/40",
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
  const choices: { v: BuyBoxFit; label: string; icon: any; activeBg: string }[] = [
    { v: "yes", label: "Fits", icon: Check, activeBg: "bg-brand-mint" },
    { v: "maybe", label: "Maybe", icon: HelpCircle, activeBg: "bg-brand-tangerine" },
    { v: "no", label: "Pass", icon: X, activeBg: "bg-brand-coral" },
  ];
  return (
    <div className="space-y-3">
      <div className="crm-eyebrow">Buy Box Check</div>
      <div className="grid grid-cols-3 gap-3">
        {choices.map((c) => {
          const active = value === c.v;
          const Icon = c.icon;
          return (
            <button
              key={c.v}
              onClick={() => onChange(c.v)}
              className={cn(
                "flex items-center justify-center gap-2 h-[52px] w-full rounded-xl text-sm font-medium transition-all",
                active
                  ? `${c.activeBg} text-white shadow-md`
                  : "bg-muted/50 text-foreground hover:bg-muted",
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
          <label className="crm-field-label">Reason for pass</label>
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
