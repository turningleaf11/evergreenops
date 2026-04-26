import { cn } from "@/lib/utils";

/**
 * Single horizontal row directly under the header, in fixed order:
 *   [Owner] · [Status pills] · [Contextual chips] · [Right-aligned slot]
 *
 * Every CRM detail sheet renders one of these so the identity area is
 * visually consistent across Leads, Contacts, Deals, Transactions, and
 * Companies.
 */
export function EntityIdentityStrip({
  owner,
  pills,
  chips,
  rightSlot,
  className,
}: {
  owner?: React.ReactNode;
  /** Status / lane / type pills (rendered as a flex row). */
  pills?: React.ReactNode;
  /** Optional contextual chips (e.g. location, value, last contacted). */
  chips?: React.ReactNode;
  /** Right-aligned slot (e.g. value, score). */
  rightSlot?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 px-6 py-3 border-b border-border/50 bg-muted/20",
        className,
      )}
    >
      <div className="flex items-center gap-3 flex-wrap min-w-0">
        {owner && <div className="shrink-0">{owner}</div>}
        {pills && <div className="flex items-center gap-1.5 flex-wrap">{pills}</div>}
        {chips && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap min-w-0">
            {chips}
          </div>
        )}
      </div>
      {rightSlot && <div className="shrink-0">{rightSlot}</div>}
    </div>
  );
}
