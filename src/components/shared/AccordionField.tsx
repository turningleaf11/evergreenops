import { ReactNode, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface FieldRowProps {
  label: string;
  icon?: React.ElementType;
  displayValue: ReactNode;
  /** Render prop receives `close` so option clicks can dismiss the popover. */
  children?: ReactNode | ((close: () => void) => ReactNode);
  popoverClassName?: string;
  align?: "start" | "center" | "end";
}

export function FieldRow({ label, icon: Icon, displayValue, children, popoverClassName, align = "start" }: FieldRowProps) {
  const [open, setOpen] = useState(false);

  // Static (non-interactive) row
  if (!children) {
    return (
      <div className="border-b border-border/30 last:border-b-0">
        <div className="w-full flex items-center gap-3 py-2.5 px-1">
          <div className="flex items-center gap-2 w-32 shrink-0">
            {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
            <span className="text-xs text-muted-foreground">{label}</span>
          </div>
          <div className="flex-1 min-w-0 text-sm text-foreground/90 truncate">
            {displayValue || <span className="text-muted-foreground/60 italic text-xs">Empty</span>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-border/30 last:border-b-0">
      <div className="w-full flex items-center gap-3 py-1.5 px-1 rounded-md group">
        {/* Label cell — non-interactive */}
        <div className="flex items-center gap-2 w-32 shrink-0">
          {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>

        {/* Value cell — IS the popover trigger so menu anchors here */}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                "flex-1 min-w-0 flex items-center justify-between gap-2 text-left text-sm text-foreground/90",
                "px-2 py-1.5 rounded-md hover:bg-muted/40 transition-colors cursor-pointer",
                "focus:outline-none focus-visible:ring-1 focus-visible:ring-ring/30",
              )}
            >
              <span className="min-w-0 truncate flex-1">
                {displayValue || <span className="text-muted-foreground/60 italic text-xs">Empty</span>}
              </span>
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 text-muted-foreground/60 transition-transform shrink-0",
                  open && "rotate-180",
                )}
              />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align={align}
            sideOffset={6}
            className={cn("w-64 p-1.5", popoverClassName)}
          >
            {typeof children === "function" ? children(() => setOpen(false)) : children}
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

// Backwards-compat alias (older imports)
export const AccordionField = FieldRow;
