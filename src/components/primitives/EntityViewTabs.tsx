// EntityViewTabs — the canonical view switcher for any list-of-work surface.
//
//   [Board] [List] [Table] [Timeline]                  [Filter] [Group by] [Sort]
//
// Used by Deals, Tasks, Projects, Goals, Leads — anywhere multiple
// visualizations of the same data make sense. Extensible: pass in
// whatever views you support; the component just renders the tabs you give it.

import { LayoutGrid, List, Table, Calendar, Filter as FilterIcon, Layers, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type ViewType = "board" | "list" | "table" | "timeline";

const VIEW_META: Record<ViewType, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  board:    { label: "Board",    icon: LayoutGrid },
  list:     { label: "List",     icon: List },
  table:    { label: "Table",    icon: Table },
  timeline: { label: "Timeline", icon: Calendar },
};

interface Props {
  views: ViewType[];
  active: ViewType;
  onChange: (v: ViewType) => void;

  /** Right-side action cluster (Filter / Group / Sort). Default: shown. */
  onFilter?: () => void;
  onGroupBy?: () => void;
  onSort?: () => void;

  className?: string;
}

export function EntityViewTabs({
  views, active, onChange,
  onFilter, onGroupBy, onSort,
  className,
}: Props) {
  return (
    <div className={cn("flex items-center justify-between gap-3 border-b border-border/60", className)}>
      <div className="flex items-center">
        {views.map((v) => {
          const Icon = VIEW_META[v].icon;
          const isActive = v === active;
          return (
            <button
              key={v}
              onClick={() => onChange(v)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                isActive
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {VIEW_META[v].label}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-1 pr-1">
        {onFilter && (
          <button
            onClick={onFilter}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <FilterIcon className="h-3.5 w-3.5" /> Filter
          </button>
        )}
        {onGroupBy && (
          <button
            onClick={onGroupBy}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <Layers className="h-3.5 w-3.5" /> Group by
          </button>
        )}
        {onSort && (
          <button
            onClick={onSort}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <ArrowUpDown className="h-3.5 w-3.5" /> Sort
          </button>
        )}
      </div>
    </div>
  );
}
