import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export type EntityTabId = "overview" | "deals" | "activity" | "files" | "more";

export const ENTITY_TAB_LABELS: Record<EntityTabId, string> = {
  overview: "Overview",
  deals: "Deals",
  activity: "Activity",
  files: "Files",
  more: "More",
};

/**
 * Standardized Tabs wrapper used by every CRM detail sheet.
 *
 * Two usage modes:
 * 1. Fixed enum (legacy): pass `hide` to omit from the default order.
 * 2. Custom tabs: pass `tabs={[{ id: "overview", label: "Overview" }, ...]}`
 *    to render entity-specific tabs (e.g. Deal: Underwriting, Broker Comms).
 *
 * Active tab gets a brand-azure 2px underline + medium weight.
 * The bar always has a bottom border separating it from content below.
 */
export function EntityTabs<V extends string = EntityTabId>({
  value,
  onValueChange,
  hide = [],
  tabs,
  className,
  actions,
  children,
}: {
  value: V;
  onValueChange: (v: V) => void;
  hide?: EntityTabId[];
  /** Optional custom tab list. When provided, overrides the default enum. */
  tabs?: Array<{ id: V; label: string }>;
  className?: string;
  /** Right-aligned actions rendered inline with the tab strip. */
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const order: EntityTabId[] = ["overview", "deals", "activity", "files", "more"];
  const resolved =
    tabs ??
    order
      .filter((t) => !hide.includes(t))
      .map((t) => ({ id: t as string, label: ENTITY_TAB_LABELS[t] }));

  return (
    <Tabs
      value={value}
      onValueChange={(v) => onValueChange(v)}
      className={cn("flex-1 flex flex-col min-h-0", className)}
    >
      <div className="px-6 border-b border-border/50 bg-background flex items-center justify-between gap-3 shrink-0">
        <TabsList className="h-11 bg-transparent rounded-none p-0 gap-1 justify-start">
          {resolved.map((t) => (
            <TabsTrigger
              key={t.id}
              value={t.id}
              className="text-sm font-normal px-3 h-11 rounded-none bg-transparent border-b-2 border-transparent text-muted-foreground hover:text-foreground data-[state=active]:bg-transparent data-[state=active]:text-brand-azure data-[state=active]:font-medium data-[state=active]:border-brand-azure data-[state=active]:shadow-none"
            >
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {actions && <div className="flex items-center gap-1 shrink-0">{actions}</div>}
      </div>
      {children}
    </Tabs>
  );
}

/**
 * Tab content panel with consistent scroll behavior.
 * Padding is intentionally `0` because EntityDetailLayout owns the layout
 * (background, padding, sidebar). Pass `className="p-6"` for legacy
 * single-column tab content.
 */
export function EntityTabPanel({
  value,
  className,
  children,
}: {
  value: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <TabsContent
      value={value}
      className={cn("flex-1 m-0 p-0 outline-none data-[state=inactive]:hidden", className)}
      forceMount
    >
      {children}
    </TabsContent>
  );
}
