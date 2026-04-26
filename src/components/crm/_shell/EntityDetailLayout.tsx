import { cn } from "@/lib/utils";

/**
 * Two-column body layout used inside every CRM detail sheet.
 *
 *   ┌──────────────────────────┬──────────────────────────┐
 *   │  MAIN (~60%)             │  SIDEBAR (280px fixed)   │
 *   │  page bg #F8F8F8         │  white, single left      │
 *   │  24px padding            │  border separating it    │
 *   │  16px gap between cards  │  20px padding            │
 *   └──────────────────────────┴──────────────────────────┘
 *
 * The main column scrolls independently of the sidebar so users always
 * have key context (owner, status, linked records) visible.
 */
export function EntityDetailLayout({
  main,
  sidebar,
  className,
}: {
  main: React.ReactNode;
  sidebar: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex-1 grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_280px] min-h-0 overflow-hidden",
        className,
      )}
    >
      <div className="overflow-auto bg-[#F8F8F8] dark:bg-muted/10 p-6">
        <div className="space-y-4 max-w-3xl">{main}</div>
      </div>
      <aside className="overflow-auto border-l border-border/50 bg-background">
        <div className="p-5 space-y-5">{sidebar}</div>
      </aside>
    </div>
  );
}

/**
 * Single section block inside the right sidebar.
 * Renders an uppercase eyebrow heading + content, with a hairline divider
 * underneath (omitted on the last child via :last-child reset).
 */
export function EntitySidebarSection({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "pb-5 border-b border-border/40 last:border-b-0 last:pb-0 space-y-3",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h4
          className="text-[11px] font-semibold uppercase text-muted-foreground"
          style={{ letterSpacing: "0.14em" }}
        >
          {title}
        </h4>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="space-y-2.5">{children}</div>
    </section>
  );
}

/**
 * Standardized label/value row inside a sidebar section.
 * Stacks on its own line with an 11px uppercase label and a 14px value below.
 */
export function EntitySidebarField({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <div
        className="text-[11px] font-semibold uppercase text-muted-foreground"
        style={{ letterSpacing: "0.14em" }}
      >
        {label}
      </div>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  );
}

/**
 * Empty / placeholder text for missing values inside the sidebar (or main).
 * Italic + muted dash, never bold.
 */
export function EntityEmpty({
  children = "Not set",
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("italic text-muted-foreground/70", className)}>
      {children}
    </span>
  );
}
