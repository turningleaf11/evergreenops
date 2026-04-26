import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export type EntityTabId = "overview" | "activity" | "files" | "more";

export const ENTITY_TAB_LABELS: Record<EntityTabId, string> = {
  overview: "Overview",
  activity: "Activity",
  files: "Files",
  more: "More",
};

/**
 * Standardized Tabs wrapper used by every CRM detail sheet.
 * Tab order is fixed: Overview · Activity · Files · More.
 * Pass `hide` to omit any tabs (e.g. an entity with no "More" content).
 */
export function EntityTabs({
  value,
  onValueChange,
  hide = [],
  className,
  children,
}: {
  value: EntityTabId;
  onValueChange: (v: EntityTabId) => void;
  hide?: EntityTabId[];
  className?: string;
  children: React.ReactNode;
}) {
  const order: EntityTabId[] = ["overview", "activity", "files", "more"];
  const visible = order.filter((t) => !hide.includes(t));

  return (
    <Tabs
      value={value}
      onValueChange={(v) => onValueChange(v as EntityTabId)}
      className={cn("flex-1 flex flex-col min-h-0", className)}
    >
      <div className="px-6 border-b border-border/50 bg-background sticky top-0 z-10">
        <TabsList className="h-11 bg-transparent rounded-none p-0 gap-1 justify-start">
          {visible.map((t) => (
            <TabsTrigger
              key={t}
              value={t}
              className="text-sm font-medium px-3 h-11 rounded-none bg-transparent border-b-2 border-transparent text-muted-foreground data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:border-primary data-[state=active]:shadow-none"
            >
              {ENTITY_TAB_LABELS[t]}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {children}
    </Tabs>
  );
}

/**
 * Tab content panel with consistent padding / scroll behavior.
 */
export function EntityTabPanel({
  value,
  className,
  children,
}: {
  value: EntityTabId;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <TabsContent
      value={value}
      className={cn("flex-1 overflow-auto m-0 p-6 outline-none", className)}
    >
      {children}
    </TabsContent>
  );
}
