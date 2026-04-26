import { cn } from "@/lib/utils";

/**
 * Standard uppercase eyebrow used between sections inside CRM detail sheets.
 * Matches the existing `crm-eyebrow` class but exposed as a component so
 * spacing and right-aligned actions are uniform.
 */
export function EntitySectionHeader({
  children,
  action,
  className,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 mb-3",
        className,
      )}
    >
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {children}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
