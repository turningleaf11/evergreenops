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

export function FieldRow({ label, icon: Icon, displayValue, children, popoverClassName, align = "end" }: FieldRowProps) {
  const [open, setOpen] = useState(false);

  const row = (
    <div
      className={cn(
        "w-full flex items-center gap-3 py-2.5 px-1 rounded-md text-left transition-colors",
        children && "hover:bg-muted/40 cursor-pointer group"
      )}
    >
      <div className="flex items-center gap-2 w-32 shrink-0">
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className="flex-1 min-w-0 text-sm text-foreground/90 truncate">
        {displayValue || <span className="text-muted-foreground/60 italic text-xs">Empty</span>}
      </div>
      {children && (
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-muted-foreground/60 transition-transform shrink-0",
            open && "rotate-180"
          )}
        />
      )}
    </div>
  );

  if (!children) {
    return <div className="border-b border-border/30 last:border-b-0">{row}</div>;
  }

  return (
    <div className="border-b border-border/30 last:border-b-0">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" className="w-full">{row}</button>
        </PopoverTrigger>
        <PopoverContent
          align={align}
          sideOffset={4}
          className={cn("w-64 p-1.5", popoverClassName)}
        >
          {typeof children === "function" ? children(() => setOpen(false)) : children}
        </PopoverContent>
      </Popover>
    </div>
  );
}

// Backwards-compat alias (older imports)
export const AccordionField = FieldRow;
