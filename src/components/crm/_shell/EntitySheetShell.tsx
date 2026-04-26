import { Loader2 } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/**
 * Opinionated Sheet wrapper used by every CRM detail sheet.
 * Standardizes width, padding, scroll behavior, and loading state so all
 * five entity sheets (Lead, Contact, Deal, Transaction, Company) feel like
 * siblings.
 *
 * NOTE: width is `sm:max-w-[640px]` by default but can be widened via
 * `width="wide"` for entity types with denser content (Lead, Deal).
 */
export function EntitySheetShell({
  open,
  onOpenChange,
  loading,
  children,
  width = "default",
  className,
  footer,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  loading?: boolean;
  children: React.ReactNode;
  /** "default" = 640px, "wide" = 1024px (Lead/Deal-class) */
  width?: "default" | "wide";
  className?: string;
  /** Optional sticky footer slot (e.g. primary action button row). */
  footer?: React.ReactNode;
}) {
  const widthClass =
    width === "wide" ? "w-full sm:max-w-5xl" : "w-full sm:max-w-2xl";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          widthClass,
          "p-0 flex flex-col gap-0 bg-background",
          className,
        )}
      >
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0">{children}</div>
        )}
        {footer && (
          <div className="border-t border-border/50 bg-background px-6 py-3">
            {footer}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
