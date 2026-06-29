// DataTable — column-driven table with user-controlled column order/
// visibility (a "Columns" manager popover — drag to reorder, checkbox to
// show/hide), optional bulk row selection with a floating action bar, and
// optional client-side pagination. Ported from autumn-design-system.
//
// Distinct from src/components/ui/data-table-shell.tsx (DataTableShell/
// DataTableHeader/DataTableRow), which stays for hand-rolled tables that
// don't need any of the above — this is additive, not a replacement.
// Existing DataTableShell call sites are unaffected.

import * as React from "react";
import { GripVertical, Columns3, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { DataTablePagination } from "@/components/shared/DataTablePagination";

export interface BulkAction<T> {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  onClick: (selectedRows: T[]) => void;
  variant?: "outline" | "destructive";
}

export interface DataTableColumn<T> {
  key: string;
  label: string;
  /** CSS grid fr-unit width, e.g. "2fr". Defaults to "1fr". */
  width?: string;
  /** Set false for a column that must always stay visible (rare). Default true. */
  hideable?: boolean;
  render: (row: T) => React.ReactNode;
}

export function useColumnOrder<T>(columns: DataTableColumn<T>[]) {
  const [order, setOrder] = React.useState(columns.map((c) => c.key));
  const [hidden, setHidden] = React.useState<Set<string>>(new Set());

  function moveColumn(from: number, to: number) {
    setOrder((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  function toggleHidden(key: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return { order, hidden, moveColumn, toggleHidden };
}

function ColumnsMenu<T>({
  columns, order, hidden, onReorder, onToggleHidden,
}: {
  columns: DataTableColumn<T>[];
  order: string[];
  hidden: Set<string>;
  onReorder: (from: number, to: number) => void;
  onToggleHidden: (key: string) => void;
}) {
  const byKey = React.useMemo(() => new Map(columns.map((c) => [c.key, c])), [columns]);
  const dragIndex = React.useRef<number | null>(null);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="inline-flex items-center gap-1.5 rounded-lg border border-border/50 bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent/60 transition-colors">
          <Columns3 className="h-3.5 w-3.5" /> Columns
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52 p-1.5">
        <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Drag to reorder</p>
        {order.map((key, i) => {
          const col = byKey.get(key);
          if (!col) return null;
          return (
            <div
              key={key}
              draggable
              onDragStart={() => { dragIndex.current = i; }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragIndex.current !== null && dragIndex.current !== i) onReorder(dragIndex.current, i);
                dragIndex.current = null;
              }}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-accent/50 cursor-grab active:cursor-grabbing"
            >
              <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
              <Checkbox
                checked={!hidden.has(key)}
                disabled={col.hideable === false}
                onCheckedChange={() => onToggleHidden(key)}
                className="h-4 w-4"
              />
              <span className="flex-1 truncate">{col.label}</span>
            </div>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  /** Adds a checkbox column + floating bulk-action bar when rows are selected. */
  selectable?: boolean;
  bulkActions?: BulkAction<T>[];
  /** Paginate client-side at this page size. Omit to show every row. */
  pageSize?: number;
  className?: string;
}

export function DataTable<T>({ columns, data, rowKey, onRowClick, selectable, bulkActions, pageSize, className }: DataTableProps<T>) {
  const { order, hidden, moveColumn, toggleHidden } = useColumnOrder(columns);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [page, setPage] = React.useState(1);
  const byKey = React.useMemo(() => new Map(columns.map((c) => [c.key, c])), [columns]);
  const visible = order.map((k) => byKey.get(k)).filter((c): c is DataTableColumn<T> => !!c && !hidden.has(c.key));
  const template = (selectable ? "32px " : "") + visible.map((c) => c.width ?? "1fr").join(" ");

  const pageCount = pageSize ? Math.max(1, Math.ceil(data.length / pageSize)) : 1;
  const pagedData = pageSize ? data.slice((page - 1) * pageSize, page * pageSize) : data;

  const allSelected = pagedData.length > 0 && pagedData.every((row) => selected.has(rowKey(row)));
  const selectedRows = data.filter((row) => selected.has(rowKey(row)));

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(pagedData.map(rowKey)));
  }

  function toggleRow(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className={cn("space-y-2 relative", className)}>
      <div className="flex justify-end">
        <ColumnsMenu columns={columns} order={order} hidden={hidden} onReorder={moveColumn} onToggleHidden={toggleHidden} />
      </div>

      <div className="rounded-xl overflow-hidden bg-card border border-border/40 shadow-card-lift">
        <div
          className="grid gap-x-4 px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[hsl(var(--brand-purple-muted))] border-b border-border/40 bg-muted/20"
          style={{ gridTemplateColumns: template }}
        >
          {selectable && (
            <Checkbox checked={allSelected} onCheckedChange={toggleAll} className="h-3.5 w-3.5" aria-label="Select all rows" />
          )}
          {visible.map((c) => <span key={c.key}>{c.label}</span>)}
        </div>

        {pagedData.map((row) => {
          const key = rowKey(row);
          return (
            <div
              key={key}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(
                "grid gap-x-4 items-center px-5 py-3 text-sm border-b border-border/30 last:border-b-0 hover:bg-accent/40 transition-colors",
                onRowClick && "cursor-pointer",
              )}
              style={{ gridTemplateColumns: template }}
            >
              {selectable && (
                <span onClick={(e) => e.stopPropagation()}>
                  <Checkbox checked={selected.has(key)} onCheckedChange={() => toggleRow(key)} className="h-3.5 w-3.5" aria-label="Select row" />
                </span>
              )}
              {visible.map((c) => <span key={c.key} className="min-w-0">{c.render(row)}</span>)}
            </div>
          );
        })}
      </div>

      {pageSize && (
        <DataTablePagination page={page} pageCount={pageCount} onPageChange={setPage} totalItems={data.length} pageSize={pageSize} className="px-1" />
      )}

      {selectable && selected.size > 0 && (
        <div className="sticky bottom-2 flex items-center gap-3 rounded-xl border border-border/40 bg-card/95 backdrop-blur-sm shadow-card-lift-hover px-4 py-2.5 mt-2">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <button onClick={() => setSelected(new Set())} className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Clear selection">
            <X className="h-3.5 w-3.5" />
          </button>
          <div className="flex-1" />
          {bulkActions?.map((action) => (
            <Button
              key={action.label}
              size="sm"
              variant={action.variant ?? "outline"}
              onClick={() => action.onClick(selectedRows)}
            >
              {action.icon && <action.icon className="h-3.5 w-3.5" />}
              {action.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
