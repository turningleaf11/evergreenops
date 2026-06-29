// FilterMenu — multi-select checkbox filters grouped by field (status,
// priority, etc.), with a count badge on the trigger and a "Clear filters"
// reset. Ported from autumn-design-system, where it was built to fill a real
// gap: list/table pages typically have an unwired "Filter" affordance with
// no actual filtering UI behind it.

import * as React from "react";
import { Filter as FilterIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";

export interface FilterField {
  key: string;
  label: string;
  options: { value: string; label: string }[];
}

/** field key -> set of selected option values */
export type FilterState = Record<string, Set<string>>;

interface Props {
  fields: FilterField[];
  value: FilterState;
  onChange: (next: FilterState) => void;
  className?: string;
}

export function activeFilterCount(state: FilterState): number {
  return Object.values(state).reduce((sum, set) => sum + set.size, 0);
}

/** Does `row[field.key]` pass the active filters? Empty selection for a field = no filter on that field. */
export function matchesFilters<T extends object>(row: T, fields: FilterField[], state: FilterState): boolean {
  const r = row as Record<string, unknown>;
  return fields.every((f) => {
    const selected = state[f.key];
    if (!selected || selected.size === 0) return true;
    return selected.has(String(r[f.key]));
  });
}

export function FilterMenu({ fields, value, onChange, className }: Props) {
  const count = activeFilterCount(value);

  function toggle(fieldKey: string, optionValue: string) {
    const current = new Set(value[fieldKey] ?? []);
    if (current.has(optionValue)) current.delete(optionValue);
    else current.add(optionValue);
    onChange({ ...value, [fieldKey]: current });
  }

  function clear() {
    onChange({});
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors",
            count > 0 ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
            className,
          )}
        >
          <FilterIcon className="h-3.5 w-3.5" /> Filter
          {count > 0 && (
            <span className="inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold">
              {count}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-60 p-3 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-foreground">Filters</p>
          {count > 0 && (
            <button onClick={clear} className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-3 w-3" /> Clear
            </button>
          )}
        </div>
        {fields.map((field) => (
          <div key={field.key} className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{field.label}</p>
            <div className="space-y-0.5">
              {field.options.map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-accent/50 cursor-pointer">
                  <Checkbox
                    checked={value[field.key]?.has(opt.value) ?? false}
                    onCheckedChange={() => toggle(field.key, opt.value)}
                    className="h-3.5 w-3.5"
                  />
                  <span className="capitalize">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </PopoverContent>
    </Popover>
  );
}
