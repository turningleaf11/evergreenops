import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, LayoutGrid, List, TableIcon, ArrowUpDown, Filter } from "lucide-react";

export type ViewMode = "list" | "board" | "table";
export type SortField = "title" | "created_at" | "due_date" | "priority" | "status";
export type SortDir = "asc" | "desc";

interface ViewControlsProps {
  search: string;
  onSearchChange: (v: string) => void;
  view: ViewMode;
  onViewChange: (v: ViewMode) => void;
  sortField: SortField;
  onSortFieldChange: (v: SortField) => void;
  sortDir: SortDir;
  onSortDirChange: (v: SortDir) => void;
  filterStatus: string;
  onFilterStatusChange: (v: string) => void;
  filterPriority: string;
  onFilterPriorityChange: (v: string) => void;
  statusOptions: { value: string; label: string }[];
  priorityOptions: { value: string; label: string }[];
  children?: React.ReactNode;
}

export default function ViewControls({
  search, onSearchChange, view, onViewChange,
  sortField, onSortFieldChange, sortDir, onSortDirChange,
  filterStatus, onFilterStatusChange, filterPriority, onFilterPriorityChange,
  statusOptions, priorityOptions, children,
}: ViewControlsProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>

        {/* Status filter */}
        <Select value={filterStatus} onValueChange={onFilterStatusChange}>
          <SelectTrigger className="w-32 h-8 text-xs">
            <Filter className="h-3 w-3 mr-1" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {statusOptions.map(s => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Priority filter */}
        <Select value={filterPriority} onValueChange={onFilterPriorityChange}>
          <SelectTrigger className="w-32 h-8 text-xs">
            <Filter className="h-3 w-3 mr-1" />
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            {priorityOptions.map(p => (
              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Sort */}
        <Select value={sortField} onValueChange={v => onSortFieldChange(v as SortField)}>
          <SelectTrigger className="w-28 h-8 text-xs">
            <ArrowUpDown className="h-3 w-3 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="created_at">Date</SelectItem>
            <SelectItem value="title">Title</SelectItem>
            <SelectItem value="priority">Priority</SelectItem>
            <SelectItem value="status">Status</SelectItem>
            <SelectItem value="due_date">Due Date</SelectItem>
          </SelectContent>
        </Select>

        <button
          onClick={() => onSortDirChange(sortDir === "asc" ? "desc" : "asc")}
          className="h-8 w-8 flex items-center justify-center rounded border border-input bg-background text-muted-foreground hover:bg-accent text-xs"
          title={sortDir === "asc" ? "Ascending" : "Descending"}
        >
          {sortDir === "asc" ? "↑" : "↓"}
        </button>

        {/* View mode */}
        <div className="flex border rounded-md overflow-hidden ml-auto">
          {([
            { mode: "list" as const, icon: List },
            { mode: "board" as const, icon: LayoutGrid },
            { mode: "table" as const, icon: TableIcon },
          ]).map(({ mode, icon: Icon }) => (
            <button
              key={mode}
              onClick={() => onViewChange(mode)}
              className={`p-1.5 ${view === mode ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>

        {children}
      </div>
    </div>
  );
}
