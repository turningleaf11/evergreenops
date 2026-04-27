import { forwardRef, type ReactNode, type HTMLAttributes, type CSSProperties } from "react";
import { cn } from "@/lib/utils";

/**
 * Shared "list table" primitives matching the CRM Transactions look:
 *  - rounded-xl card with thin border + soft shadow
 *  - sticky-feeling header row: tiny uppercase tracked muted purple labels on bg-muted/20
 *  - grid-based rows with border-b border-border/30, hover #F9F9F9
 *  - pill-style badges via DataTablePill
 *
 * These are presentational only — wire your own onClick/data.
 */

interface DataTableShellProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function DataTableShell({ className, children, style, ...rest }: DataTableShellProps) {
  return (
    <div
      className={cn("rounded-xl overflow-hidden bg-card", className)}
      style={{
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        border: "1px solid hsl(var(--border) / 0.5)",
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

interface ColumnsProps {
  /** CSS grid-template-columns value, e.g. "2.4fr 1fr 1.4fr 40px" */
  template: string;
  children: ReactNode;
  className?: string;
}

export function DataTableHeader({ template, children, className }: ColumnsProps) {
  return (
    <div
      className={cn(
        "grid px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[hsl(var(--brand-purple-muted))] border-b border-border/40 bg-muted/20",
        className,
      )}
      style={{ gridTemplateColumns: template }}
    >
      {children}
    </div>
  );
}

interface RowProps extends Omit<HTMLAttributes<HTMLDivElement>, "onClick"> {
  template: string;
  onClick?: () => void;
  asButton?: boolean;
  children: ReactNode;
}

export const DataTableRow = forwardRef<HTMLDivElement, RowProps>(function DataTableRow(
  { template, onClick, asButton, className, children, style, ...rest },
  ref,
) {
  const base =
    "group grid items-center px-5 py-3 text-sm border-b border-border/30 last:border-b-0 hover:bg-[#F9F9F9] dark:hover:bg-muted/30 transition-colors";
  const gridStyle: CSSProperties = { gridTemplateColumns: template, ...style };
  if (asButton) {
    return (
      <button
        // @ts-expect-error - shared ref shape
        ref={ref}
        type="button"
        onClick={onClick}
        className={cn("w-full text-left", base, className)}
        style={gridStyle}
      >
        {children}
      </button>
    );
  }
  return (
    <div
      ref={ref}
      onClick={onClick}
      className={cn(base, onClick && "cursor-pointer", className)}
      style={gridStyle}
      {...rest}
    >
      {children}
    </div>
  );
});

interface PillProps {
  /** HSL color triplet string like "200 80% 50%". If omitted, uses muted style. */
  hsl?: string;
  /** Override background opacity, default 0.15 */
  bgOpacity?: number;
  /** Override text opacity, default 1 */
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

export function DataTablePill({ hsl, bgOpacity = 0.15, className, style, children }: PillProps) {
  const themed: CSSProperties = hsl
    ? {
        backgroundColor: `hsl(${hsl} / ${bgOpacity})`,
        color: `hsl(${hsl})`,
      }
    : {};
  return (
    <span
      className={cn(
        "inline-flex items-center font-semibold rounded-full text-[11px] px-2.5 py-[3px]",
        !hsl && "bg-muted text-muted-foreground",
        className,
      )}
      style={{ ...themed, ...style }}
    >
      {children}
    </span>
  );
}

interface FilterBarProps {
  children: ReactNode;
  right?: ReactNode;
  className?: string;
}

export function DataTableFilterBar({ children, right, className }: FilterBarProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between flex-wrap gap-3 rounded-xl border border-border/50 bg-card px-4 py-3",
        className,
      )}
    >
      <div className="flex items-center gap-2 flex-wrap">{children}</div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </div>
  );
}

interface EmptyProps {
  icon?: ReactNode;
  title: string;
  hint?: ReactNode;
  className?: string;
}

export function DataTableEmpty({ icon, title, hint, className }: EmptyProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/50 bg-card py-16 text-center text-sm text-muted-foreground",
        className,
      )}
    >
      {icon && <div className="mx-auto mb-2 opacity-50 inline-flex">{icon}</div>}
      <p className="font-medium text-foreground mb-1">{title}</p>
      {hint && <p>{hint}</p>}
    </div>
  );
}
