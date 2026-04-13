import { useState } from "react";
import type { DatabaseColumn } from "@/lib/mock-data";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Filter, ArrowUpDown, Layers, X, Plus } from "lucide-react";

export interface FilterDef {
  columnId: string;
  operator: "is" | "is_not" | "contains" | "is_empty" | "is_not_empty";
  value: string;
}

export interface SortDef {
  columnId: string;
  direction: "asc" | "desc";
}

interface DatabaseViewControlsProps {
  columns: DatabaseColumn[];
  filters: FilterDef[];
  sorts: SortDef[];
  groupBy: string | null;
  onFiltersChange: (f: FilterDef[]) => void;
  onSortsChange: (s: SortDef[]) => void;
  onGroupByChange: (g: string | null) => void;
}

export default function DatabaseViewControls({ columns, filters, sorts, groupBy, onFiltersChange, onSortsChange, onGroupByChange }: DatabaseViewControlsProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <FilterPopover columns={columns} filters={filters} onChange={onFiltersChange} />
      <SortPopover columns={columns} sorts={sorts} onChange={onSortsChange} />
      <GroupPopover columns={columns} groupBy={groupBy} onChange={onGroupByChange} />
      {filters.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {filters.map((f, i) => {
            const col = columns.find(c => c.id === f.columnId);
            return (
              <Badge key={i} variant="secondary" className="text-[10px] gap-1 pr-1">
                {col?.name} {f.operator} {f.value}
                <button onClick={() => onFiltersChange(filters.filter((_, j) => j !== i))}><X className="h-2.5 w-2.5" /></button>
              </Badge>
            );
          })}
        </div>
      )}
      {sorts.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {sorts.map((s, i) => {
            const col = columns.find(c => c.id === s.columnId);
            return (
              <Badge key={i} variant="outline" className="text-[10px] gap-1 pr-1">
                {col?.name} {s.direction === "asc" ? "↑" : "↓"}
                <button onClick={() => onSortsChange(sorts.filter((_, j) => j !== i))}><X className="h-2.5 w-2.5" /></button>
              </Badge>
            );
          })}
        </div>
      )}
      {groupBy && (
        <Badge variant="outline" className="text-[10px] gap-1 pr-1">
          Grouped: {columns.find(c => c.id === groupBy)?.name}
          <button onClick={() => onGroupByChange(null)}><X className="h-2.5 w-2.5" /></button>
        </Badge>
      )}
    </div>
  );
}

function FilterPopover({ columns, filters, onChange }: { columns: DatabaseColumn[]; filters: FilterDef[]; onChange: (f: FilterDef[]) => void }) {
  const [col, setCol] = useState(columns[0]?.id || "");
  const [op, setOp] = useState<FilterDef["operator"]>("contains");
  const [val, setVal] = useState("");

  const addFilter = () => {
    if (!col) return;
    onChange([...filters, { columnId: col, operator: op, value: val }]);
    setVal("");
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
          <Filter className="h-3 w-3" /> Filter {filters.length > 0 && `(${filters.length})`}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-3" align="start">
        <p className="text-sm font-medium">Add Filter</p>
        <Select value={col} onValueChange={setCol}>
          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{columns.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={op} onValueChange={v => setOp(v as FilterDef["operator"])}>
          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="is">is</SelectItem>
            <SelectItem value="is_not">is not</SelectItem>
            <SelectItem value="contains">contains</SelectItem>
            <SelectItem value="is_empty">is empty</SelectItem>
            <SelectItem value="is_not_empty">is not empty</SelectItem>
          </SelectContent>
        </Select>
        {!["is_empty", "is_not_empty"].includes(op) && (
          <Input value={val} onChange={e => setVal(e.target.value)} placeholder="Value" className="h-7 text-xs" />
        )}
        <Button size="sm" className="w-full h-7 text-xs" onClick={addFilter}>
          <Plus className="h-3 w-3 mr-1" /> Add Filter
        </Button>
      </PopoverContent>
    </Popover>
  );
}

function SortPopover({ columns, sorts, onChange }: { columns: DatabaseColumn[]; sorts: SortDef[]; onChange: (s: SortDef[]) => void }) {
  const [col, setCol] = useState(columns[0]?.id || "");
  const [dir, setDir] = useState<"asc" | "desc">("asc");

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
          <ArrowUpDown className="h-3 w-3" /> Sort {sorts.length > 0 && `(${sorts.length})`}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 space-y-3" align="start">
        <p className="text-sm font-medium">Add Sort</p>
        <Select value={col} onValueChange={setCol}>
          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{columns.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={dir} onValueChange={v => setDir(v as "asc" | "desc")}>
          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="asc">Ascending</SelectItem>
            <SelectItem value="desc">Descending</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" className="w-full h-7 text-xs" onClick={() => { onChange([...sorts, { columnId: col, direction: dir }]); }}>
          <Plus className="h-3 w-3 mr-1" /> Add Sort
        </Button>
      </PopoverContent>
    </Popover>
  );
}

function GroupPopover({ columns, groupBy, onChange }: { columns: DatabaseColumn[]; groupBy: string | null; onChange: (g: string | null) => void }) {
  const groupable = columns.filter(c => ["select", "multi_select", "status", "person"].includes(c.type));
  if (groupable.length === 0) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
          <Layers className="h-3 w-3" /> Group
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 space-y-2" align="start">
        <p className="text-sm font-medium">Group By</p>
        <button onClick={() => onChange(null)} className={`w-full text-left px-2 py-1 text-xs rounded ${!groupBy ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
          None
        </button>
        {groupable.map(c => (
          <button key={c.id} onClick={() => onChange(c.id)} className={`w-full text-left px-2 py-1 text-xs rounded ${groupBy === c.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
            {c.name}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

// Utility: apply filters and sorts to rows
export function applyFiltersAndSorts(
  rows: { id: string; values: Record<string, any> }[],
  filters: FilterDef[],
  sorts: SortDef[]
) {
  let result = [...rows];

  for (const f of filters) {
    result = result.filter(row => {
      const val = row.values[f.columnId];
      const strVal = val != null ? String(val).toLowerCase() : "";
      switch (f.operator) {
        case "is": return strVal === f.value.toLowerCase();
        case "is_not": return strVal !== f.value.toLowerCase();
        case "contains": return strVal.includes(f.value.toLowerCase());
        case "is_empty": return val == null || strVal === "";
        case "is_not_empty": return val != null && strVal !== "";
        default: return true;
      }
    });
  }

  if (sorts.length > 0) {
    result.sort((a, b) => {
      for (const s of sorts) {
        const aVal = a.values[s.columnId] ?? "";
        const bVal = b.values[s.columnId] ?? "";
        const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
        if (cmp !== 0) return s.direction === "asc" ? cmp : -cmp;
      }
      return 0;
    });
  }

  return result;
}
