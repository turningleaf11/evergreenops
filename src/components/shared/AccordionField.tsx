import { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface AccordionFieldProps {
  label: string;
  icon?: React.ElementType;
  isOpen: boolean;
  onToggle: () => void;
  displayValue: ReactNode;
  children: ReactNode;
}

export function AccordionField({ label, icon: Icon, isOpen, onToggle, displayValue, children }: AccordionFieldProps) {
  return (
    <div className="border-b border-border/30 last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 py-2.5 px-1 hover:bg-muted/40 rounded-md transition-colors text-left group"
      >
        <div className="flex items-center gap-2 w-32 shrink-0">
          {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <div className="flex-1 min-w-0 text-sm text-foreground/90 truncate">
          {displayValue || <span className="text-muted-foreground/60 italic text-xs">Empty</span>}
        </div>
        <ChevronRight
          className={cn(
            "h-3.5 w-3.5 text-muted-foreground/60 transition-transform shrink-0",
            isOpen && "rotate-90"
          )}
        />
      </button>
      {isOpen && (
        <div className="pl-[140px] pr-2 pb-3 pt-1 animate-accordion-down">
          {children}
        </div>
      )}
    </div>
  );
}
