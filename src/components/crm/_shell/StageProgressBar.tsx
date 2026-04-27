import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StageProgressItem {
  id: string;
  label: string;
  /** Treats this stage as a "lost"/terminal-bad stage (renders muted/coral). */
  isLost?: boolean;
  /** Treats this stage as a "won"/closed stage (renders mint when active/past). */
  isWon?: boolean;
}

/**
 * Clickable horizontal stage progression bar used at the top of CRM detail
 * sheets (Lead, Deal, Transaction). Each segment is a clickable chevron-shaped
 * pill. Stages at-or-before the current stage are filled; future stages are
 * outlined.
 */
export function StageProgressBar({
  stages,
  currentId,
  onChange,
  disabled,
  className,
}: {
  stages: StageProgressItem[];
  currentId: string | null | undefined;
  onChange: (id: string) => void | Promise<void>;
  disabled?: boolean;
  className?: string;
}) {
  if (!stages.length) return null;
  const currentIndex = Math.max(
    0,
    stages.findIndex((s) => s.id === currentId),
  );
  const current = stages[currentIndex];
  const isLostFlow = !!current?.isLost;
  const isWonFlow = !!current?.isWon;

  return (
    <div
      className={cn(
        "flex items-stretch gap-1 w-full overflow-x-auto",
        className,
      )}
      role="tablist"
      aria-label="Stage progression"
    >
      {stages.map((s, i) => {
        const past = i < currentIndex;
        const active = i === currentIndex;
        const future = i > currentIndex;

        // Color scheme
        let cls =
          "border-border/60 bg-background text-muted-foreground hover:bg-muted/50";
        if (past) {
          cls =
            "bg-brand-mint/15 border-brand-mint/30 text-brand-mint-deep hover:bg-brand-mint/25";
        }
        if (active) {
          if (isLostFlow) {
            cls =
              "bg-brand-coral/15 border-brand-coral/40 text-brand-coral font-semibold";
          } else if (isWonFlow) {
            cls =
              "bg-brand-mint border-brand-mint text-white font-semibold";
          } else {
            cls =
              "bg-brand-azure border-brand-azure text-white font-semibold shadow-sm";
          }
        }

        return (
          <button
            key={s.id}
            type="button"
            disabled={disabled}
            onClick={() => !disabled && void onChange(s.id)}
            className={cn(
              "group flex-1 min-w-[88px] inline-flex items-center justify-center gap-1.5 px-3 h-9 rounded-md border text-[12px] font-medium transition-all",
              cls,
              disabled && "opacity-60 cursor-not-allowed",
            )}
            title={s.label}
            aria-current={active ? "step" : undefined}
          >
            {past && (
              <Check className="h-3 w-3 shrink-0" strokeWidth={3} />
            )}
            <span className="truncate">{s.label}</span>
          </button>
        );
      })}
    </div>
  );
}
