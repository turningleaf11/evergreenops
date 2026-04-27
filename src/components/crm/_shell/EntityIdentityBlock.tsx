import { cn } from "@/lib/utils";

/**
 * Identity block rendered as the FIRST item in a CRM detail-sheet sidebar.
 * Mirrors the visual style of the Contact peek's identity area:
 *   - Big bold record name
 *   - Small badge / type chip row
 *   - Optional muted "since" / "last contacted" line
 *
 * Children render below the heading so callers can drop in record-specific
 * meta (Owner, Contact, Source, Team, etc.) using EntitySidebarSection.
 */
export function EntityIdentityBlock({
  title,
  badges,
  meta,
  children,
  className,
}: {
  title: React.ReactNode;
  /** Pills/chips below the title (e.g. status, lane, type). */
  badges?: React.ReactNode;
  /** Subtle 12px lines under the badges (e.g. "Last contacted 2h ago"). */
  meta?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-3 pb-5 border-b border-border/40", className)}>
      <div className="space-y-2">
        <h2 className="text-[20px] font-semibold leading-tight text-foreground break-words">
          {title}
        </h2>
        {badges && (
          <div className="flex items-center gap-1.5 flex-wrap">{badges}</div>
        )}
        {meta && (
          <div className="space-y-0.5 text-[12px] text-muted-foreground/80">
            {meta}
          </div>
        )}
      </div>
      {children}
    </section>
  );
}
