import { cn } from "@/lib/utils";

/**
 * Card-style section used in the main column of CRM detail sheets.
 * Matches Contact's overview card styling: rounded-xl, soft shadow, eyebrow
 * heading + content area.
 */
export function OverviewCard({
  title,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={cn("bg-card", className)}
      style={{
        borderRadius: 12,
        padding: 24,
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      }}
    >
      {(title || action) && (
        <div className="flex items-center justify-between gap-2 mb-4">
          {title && (
            <h3
              className="text-[11px] font-semibold uppercase"
              style={{ letterSpacing: "0.12em", color: "#9896B8" }}
            >
              {title}
            </h3>
          )}
          {action}
        </div>
      )}
      <div className={cn("space-y-3", bodyClassName)}>{children}</div>
    </section>
  );
}
