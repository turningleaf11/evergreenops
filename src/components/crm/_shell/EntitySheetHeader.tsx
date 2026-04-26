import { ChevronUp, ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Standard header for every CRM detail sheet.
 *
 * Layout: [prev/next column?] [title block] ······ [actions slot] [close]
 *
 * Title sizing, padding, and divider are fixed so all sheets read as siblings.
 */
export function EntitySheetHeader({
  title,
  subtitle,
  onClose,
  onPrev,
  onNext,
  prevDisabled,
  nextDisabled,
  actions,
  leading,
  className,
  titleClassName,
}: {
  title: string;
  subtitle?: React.ReactNode;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  prevDisabled?: boolean;
  nextDisabled?: boolean;
  /** Right-aligned actions (buttons, menus). */
  actions?: React.ReactNode;
  /** Optional leading element (icon) next to the title. */
  leading?: React.ReactNode;
  className?: string;
  /** Override the default title typography (e.g. larger size for primary entities). */
  titleClassName?: string;
}) {
  const showNav = !!(onPrev || onNext);
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 px-6 pt-5 pb-4 border-b border-border/50",
        className,
      )}
    >
      <div className="flex items-start gap-2 min-w-0 flex-1">
        {showNav && (
          <div className="flex flex-col -ml-1 mt-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-6"
              disabled={prevDisabled}
              onClick={onPrev}
              title="Previous"
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-6"
              disabled={nextDisabled}
              onClick={onNext}
              title="Next"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
        {leading && <div className="mt-1 shrink-0">{leading}</div>}
        <div className="min-w-0 flex-1">
          <h2 className={cn("text-lg font-semibold leading-tight truncate", titleClassName)}>{title}</h2>
          {subtitle && (
            <div className="text-xs text-muted-foreground mt-0.5 min-w-0">{subtitle}</div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0 pr-8">
        {actions}
      </div>
    </div>
  );
}
