import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import type { Database, DatabaseRow, DatabaseColumn } from "@/lib/mock-data";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, LayoutGrid, List, TableIcon, Plus, Trash2, Link as LinkIcon, ExternalLink, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, Calendar, Maximize2, MoreHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import DatabaseViewControls, { FilterDef, SortDef, applyFiltersAndSorts } from "@/components/DatabaseViewControls";
import { AddColumnPopover, ColumnHeaderMenu } from "@/components/ColumnManager";
import { useColumnWidths } from "@/hooks/useColumnWidths";
import { useViewPreference } from "@/hooks/useViewPreference";
import { InlineText, InlineSelect, InlineDate } from "@/components/shared/InlineCell";

type ViewMode = "table" | "kanban" | "list";

const selectColors: Record<string, string> = {
  "Not Started": "220 10% 46%", "To Do": "220 10% 46%", "Draft": "220 10% 46%",
  "Open": "0 72% 51%", "In Progress": "220 65% 48%", "Investigating": "220 65% 48%",
  "In Review": "38 92% 50%", "Completed": "142 71% 45%", "Done": "142 71% 45%",
  "Fixed": "142 71% 45%", "Approved": "142 71% 45%", "Published": "142 71% 45%",
  "Closed": "220 10% 46%", "Blocked": "0 72% 51%", "Low": "220 10% 46%",
  "Medium": "38 92% 50%", "High": "25 95% 53%", "Urgent": "0 72% 51%", "Critical": "0 72% 51%",
  "Lead": "220 10% 46%", "Contacted": "38 92% 50%", "Offer Sent": "220 65% 48%",
  "Under Contract": "280 65% 48%", "In DD": "38 92% 50%", "Closing": "142 71% 45%",
  "Marketing": "38 92% 50%", "Buyer Interested": "220 65% 48%", "Closing Scheduled": "280 65% 48%",
  "Fell Through": "0 72% 51%", "Dead": "220 10% 30%",
};

function getColor(value: string): string {
  return selectColors[value] || "220 10% 46%";
}

interface DatabaseViewProps {
  database: Database;
  rows: DatabaseRow[];
  onAdd?: () => void;
  onEdit?: (row: DatabaseRow) => void;
  onDelete?: (rowId: string) => void;
  onRowUpdate?: (rowId: string, values: Record<string, any>) => void;
  allDatabases?: Database[];
  allRows?: DatabaseRow[];
  onColumnsChange?: (columns: DatabaseColumn[]) => void;
  isAdmin?: boolean;
}

export default function DatabaseView({ database, rows, onAdd, onEdit, onDelete, onRowUpdate, allDatabases, allRows, onColumnsChange, isAdmin }: DatabaseViewProps) {
  const [view, setView] = useViewPreference<ViewMode>(`db:${database.id}:view`, "table");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<FilterDef[]>([]);
  const [sorts, setSorts] = useState<SortDef[]>([]);
  const [groupBy, setGroupBy] = useState<string | null>(null);

  const searchFiltered = rows.filter(row => {
    const searchStr = Object.values(row.values).map(v => String(v ?? "")).join(" ").toLowerCase();
    return searchStr.includes(search.toLowerCase());
  });

  const processed = applyFiltersAndSorts(searchFiltered, filters, sorts);

  const kanbanColumn = database.columns.find(c => (c.type === "select" || c.type === "status") && c.id !== "title") || database.columns[1];

  const handleAddColumn = (col: DatabaseColumn) => {
    const newCols = [...database.columns, col];
    onColumnsChange?.(newCols);
  };

  const handleRenameColumn = (id: string, name: string) => {
    const newCols = database.columns.map(c => c.id === id ? { ...c, name } : c);
    onColumnsChange?.(newCols);
  };

  const handleDeleteColumn = (id: string) => {
    const newCols = database.columns.filter(c => c.id !== id);
    onColumnsChange?.(newCols);
  };

  const handleMoveColumn = (id: string, direction: "left" | "right") => {
    const cols = [...database.columns];
    const idx = cols.findIndex(c => c.id === id);
    if (direction === "left" && idx > 0) [cols[idx - 1], cols[idx]] = [cols[idx], cols[idx - 1]];
    if (direction === "right" && idx < cols.length - 1) [cols[idx + 1], cols[idx]] = [cols[idx], cols[idx + 1]];
    onColumnsChange?.(cols);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex gap-2 items-center">
            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-8 text-sm w-48" />
            </div>
          </div>
          <div className="flex gap-2 items-center">
            {onAdd && (
              <Button size="sm" onClick={onAdd} className="h-8 text-xs">
                <Plus className="h-3.5 w-3.5 mr-1" /> New Row
              </Button>
            )}
            <div className="flex border rounded-md overflow-hidden">
              {([
                { mode: "table" as const, icon: TableIcon },
                { mode: "kanban" as const, icon: LayoutGrid },
                { mode: "list" as const, icon: List },
              ]).map(({ mode, icon: Icon }) => (
                <button key={mode} onClick={() => setView(mode)} className={`p-1.5 ${view === mode ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}>
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>
        </div>
        <DatabaseViewControls
          columns={database.columns}
          filters={filters}
          sorts={sorts}
          groupBy={groupBy}
          onFiltersChange={setFilters}
          onSortsChange={setSorts}
          onGroupByChange={setGroupBy}
        />
      </div>

      {view === "table" && (
        <GenericTable
          database={database}
          rows={processed as DatabaseRow[]}
          onEdit={onEdit}
          onDelete={onDelete}
          onRowUpdate={onRowUpdate}
          allDatabases={allDatabases}
          allRows={allRows}
          groupBy={groupBy}
          isAdmin={isAdmin}
          onAddColumn={handleAddColumn}
          onRenameColumn={handleRenameColumn}
          onDeleteColumn={handleDeleteColumn}
          onMoveLeft={id => handleMoveColumn(id, "left")}
          onMoveRight={id => handleMoveColumn(id, "right")}
        />
      )}
      {view === "kanban" && <GenericKanban database={database} rows={processed as DatabaseRow[]} kanbanColumn={kanbanColumn} onEdit={onEdit} allDatabases={allDatabases} allRows={allRows} />}
      {view === "list" && <GenericList database={database} rows={processed as DatabaseRow[]} onEdit={onEdit} groupBy={groupBy} />}
    </div>
  );
}

function RelationChips({ column, value, allDatabases, allRows }: { column: DatabaseColumn; value: any; allDatabases?: Database[]; allRows?: DatabaseRow[] }) {
  const navigate = useNavigate();
  if (!column.relationConfig || !allRows) return <span className="text-muted-foreground">—</span>;
  const ids: string[] = Array.isArray(value) ? value : (value ? [value] : []);
  if (ids.length === 0) return <span className="text-muted-foreground">—</span>;
  const targetDbId = column.relationConfig.databaseId;
  return (
    <div className="flex gap-1 flex-wrap">
      {ids.map(id => {
        const row = allRows.find(r => r.id === id);
        if (!row) return null;
        return (
          <button key={id} onClick={(e) => { e.stopPropagation(); navigate(`/databases/${targetDbId}`); }}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[11px] font-medium hover:bg-primary/20 transition-colors">
            <LinkIcon className="h-2.5 w-2.5" />{row.values.title || "Untitled"}
          </button>
        );
      })}
    </div>
  );
}

function CellValue({ column, value, allDatabases, allRows }: { column: DatabaseColumn; value: any; allDatabases?: Database[]; allRows?: DatabaseRow[] }) {
  if (column.type === "relation") return <RelationChips column={column} value={value} allDatabases={allDatabases} allRows={allRows} />;
  if (value === undefined || value === null) return <span className="text-muted-foreground">—</span>;

  switch (column.type) {
    case "select":
    case "status":
      return (
        <Badge variant="outline" className="text-[10px] gap-1" style={{ borderColor: `hsl(${getColor(value)})`, color: `hsl(${getColor(value)})` }}>
          {column.type === "status" && <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: `hsl(${getColor(value)})` }} />}
          {value}
        </Badge>
      );
    case "multi_select":
    case "tags":
      return (
        <div className="flex gap-1 flex-wrap">
          {(Array.isArray(value) ? value : []).map((v: string) => (
            <Badge key={v} variant="secondary" className="text-[10px] px-1.5 py-0">{v}</Badge>
          ))}
        </div>
      );
    case "currency":
      return <span className="text-sm font-mono">${typeof value === "number" ? value.toLocaleString() : value}</span>;
    case "email":
      return <a href={`mailto:${value}`} className="text-xs text-primary underline truncate max-w-[150px] block" onClick={e => e.stopPropagation()}>{value}</a>;
    case "phone":
      return <a href={`tel:${value}`} className="text-xs text-primary underline" onClick={e => e.stopPropagation()}>{value}</a>;
    case "file":
      return value ? <a href={value} className="file-attachment text-xs text-primary underline flex items-center gap-1" onClick={e => e.stopPropagation()}><ExternalLink className="h-3 w-3" />File</a> : <span className="text-muted-foreground">—</span>;
    case "progress":
      const pct = typeof value === "number" ? value : 0;
      return (
        <div className="flex items-center gap-2">
          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} /></div>
          <span className="text-xs text-muted-foreground">{pct}%</span>
        </div>
      );
    case "checkbox":
      return <span>{value ? "✓" : "—"}</span>;
    case "url":
      return <a href={value} className="text-xs text-primary underline truncate max-w-[150px] block" onClick={e => e.stopPropagation()}>{value}</a>;
    case "long_text":
      return <span className="text-sm text-muted-foreground truncate max-w-[200px] block">{String(value).substring(0, 80)}{String(value).length > 80 ? "…" : ""}</span>;
    case "date":
      return <span className="text-sm text-muted-foreground">{value}</span>;
    case "person":
      return <span className="text-sm">{value}</span>;
    default:
      return <span className="text-sm">{String(value)}</span>;
  }
}

interface GenericTableProps {
  database: Database;
  rows: DatabaseRow[];
  onEdit?: (r: DatabaseRow) => void;
  onDelete?: (id: string) => void;
  onRowUpdate?: (rowId: string, values: Record<string, any>) => void;
  allDatabases?: Database[];
  allRows?: DatabaseRow[];
  groupBy: string | null;
  isAdmin?: boolean;
  onAddColumn: (col: DatabaseColumn) => void;
  onRenameColumn: (id: string, name: string) => void;
  onDeleteColumn: (id: string) => void;
  onMoveLeft: (id: string) => void;
  onMoveRight: (id: string) => void;
}

function GenericTable({ database, rows, onEdit, onDelete, onRowUpdate, allDatabases, allRows, groupBy, isAdmin, onAddColumn, onRenameColumn, onDeleteColumn, onMoveLeft, onMoveRight }: GenericTableProps) {
  const allCols = database.columns;
  const titleCol = allCols.find(c => c.id === "title");
  const otherCols = allCols.filter(c => c.id !== "title");
  const orderedCols = titleCol ? [titleCol, ...otherCols] : otherCols;

  const viewKey = `database-${database.id}`;
  const { widths: storedWidths, setWidth } = useColumnWidths(viewKey);
  const hasStored = (id: string) => Object.prototype.hasOwnProperty.call(storedWidths, id);
  const getWidth = (id: string, fallback: number) => storedWidths[id] ?? fallback;

  const startResize = useCallback((colId: string, startX: number, startWidth: number) => {
    const onMove = (e: PointerEvent) => setWidth(colId, startWidth + (e.clientX - startX));
    const onUp = () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [setWidth]);

  // Auto-size title column based on the longest title currently visible.
  const autoTitleWidth = (() => {
    const longest = rows.reduce((max, r) => {
      const t = String(r.values?.title ?? "");
      return t.length > max ? t.length : max;
    }, 0);
    // ~7.5px per char for 14px font + padding, clamped to a sensible range
    return Math.min(480, Math.max(180, Math.round(longest * 7.5) + 48));
  })();

  // Default widths by column position
  const defaultWidthFor = (col: DatabaseColumn, idx: number) => {
    if (col.id === "title") return autoTitleWidth;
    if (idx === orderedCols.length - 1) return 180;
    return 160;
  };

  const gridTemplate = orderedCols.map((c, i) => {
    const w = getWidth(c.id, defaultWidthFor(c, i));
    if (i === orderedCols.length - 1 && !hasStored(c.id)) return `minmax(120px, 1fr)`;
    return `${w}px`;
  }).join(" ") + (isAdmin ? " 40px" : "") + ((onEdit || onDelete) ? " 60px" : "");

  const updateCell = (row: DatabaseRow, colId: string, val: any) => {
    if (!onRowUpdate) return;
    onRowUpdate(row.id, { ...row.values, [colId]: val });
  };

  const renderCell = (col: DatabaseColumn, row: DatabaseRow) => {
    const v = row.values[col.id];
    if (col.type === "select" || col.type === "status") {
      const opts = (col.options || []).map(o => ({ value: o, label: o }));
      return (
        <InlineSelect
          value={v || ""}
          options={opts}
          onChange={(nv) => updateCell(row, col.id, nv)}
          renderDisplay={(val) => val ? (
            <Badge variant="outline" className="text-[10px] gap-1" style={{ borderColor: `hsl(${getColor(val)})`, color: `hsl(${getColor(val)})` }}>
              {col.type === "status" && <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: `hsl(${getColor(val)})` }} />}
              {val}
            </Badge>
          ) : <span className="text-xs text-muted-foreground/60">—</span>}
        />
      );
    }
    if (col.type === "date") {
      return <InlineDate value={v} onChange={(nv) => updateCell(row, col.id, nv)} />;
    }
    if (col.type === "text" || col.type === "long_text" || col.type === "number" || col.type === "currency" || col.type === "url" || col.type === "email" || col.type === "phone") {
      return (
        <InlineText
          value={v ?? ""}
          onChange={(nv) => updateCell(row, col.id, nv)}
        />
      );
    }
    return <CellValue column={col} value={v} allDatabases={allDatabases} allRows={allRows} />;
  };

  const renderRows = (rowsToRender: DatabaseRow[]) => rowsToRender.map(row => (
    <div
      key={row.id}
      className="grid items-center hover:bg-muted/30 transition-colors group"
      style={{ gridTemplateColumns: gridTemplate }}
    >
      {orderedCols.map((col) => (
        <div key={col.id} className="px-3 py-1.5 min-w-0">
          {col.id === "title" ? (
            <InlineText
              value={row.values.title || ""}
              onChange={(nv) => updateCell(row, "title", nv)}
              className="font-medium"
              placeholder="Untitled"
            />
          ) : renderCell(col, row)}
        </div>
      ))}
      {isAdmin && <div />}
      {(onEdit || onDelete) && (
        <div className="px-2 flex items-center justify-end gap-0.5">
          {onEdit && (
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(row); }}
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors opacity-60 group-hover:opacity-100"
              title="Open record"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          )}
          {onDelete && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  onClick={(e) => e.stopPropagation()}
                  className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100"
                  title="More actions"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem
                  onClick={(e) => { e.stopPropagation(); onDelete(row.id); }}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-2" />
                  Delete row
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      )}
    </div>
  ));

  const groupCol = groupBy ? allCols.find(c => c.id === groupBy) : null;

  const scrollRef = useRef<HTMLDivElement>(null);
  const [overflowState, setOverflowState] = useState<{ left: boolean; right: boolean }>({ left: false, right: false });
  const updateOverflow = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const hasOverflow = el.scrollWidth > el.clientWidth + 1;
    setOverflowState({
      left: hasOverflow && el.scrollLeft > 4,
      right: hasOverflow && el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
    });
  }, []);
  useEffect(() => {
    updateOverflow();
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(updateOverflow);
    ro.observe(el);
    return () => ro.disconnect();
  }, [updateOverflow, orderedCols.length, rows.length]);
  const onWheel = (e: React.WheelEvent) => {
    if (e.shiftKey && scrollRef.current) scrollRef.current.scrollLeft += e.deltaY;
  };
  const scrollByCol = (dir: -1 | 1) => scrollRef.current?.scrollBy({ left: dir * 300, behavior: "smooth" });

  return (
    <div className="relative group/table rounded-xl border border-border/50 overflow-hidden">
      <div ref={scrollRef} onScroll={updateOverflow} onWheel={onWheel} className="overflow-x-auto scrollbar-hide">
        <div className="min-w-full">
          {/* Header */}
          <div className="grid bg-muted/30 border-b border-border/50" style={{ gridTemplateColumns: gridTemplate }}>
            {orderedCols.map((col, i) => (
              <div
                key={col.id}
                className="relative flex items-center px-3 py-2.5 text-xs font-medium text-muted-foreground select-none"
              >
                <span className="truncate flex-1">
                  {isAdmin && col.id !== "title" ? (
                    <ColumnHeaderMenu
                      column={col}
                      index={i - 1}
                      total={otherCols.length}
                      onRename={onRenameColumn}
                      onDelete={onDeleteColumn}
                      onMoveLeft={onMoveLeft}
                      onMoveRight={onMoveRight}
                    />
                  ) : col.name || "Title"}
                </span>
                <div
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    startResize(col.id, e.clientX, getWidth(col.id, defaultWidthFor(col, i)));
                  }}
                  className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-primary/40 active:bg-primary/60 transition-colors"
                />
              </div>
            ))}
            {isAdmin && (
              <div className="flex items-center justify-center">
                <AddColumnPopover onAdd={onAddColumn} />
              </div>
            )}
            {(onEdit || onDelete) && <div />}
          </div>

          {/* Body */}
          <div className="divide-y divide-border/30">
            {groupCol && groupCol.options ? (
              groupCol.options.map(group => {
                const groupRows = rows.filter(r => r.values[groupBy!] === group);
                if (groupRows.length === 0) return null;
                return (
                  <React.Fragment key={group}>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/40">
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: `hsl(${getColor(group)})` }} />
                      <span className="text-xs font-medium">{group}</span>
                      <span className="text-[10px] text-muted-foreground">({groupRows.length})</span>
                    </div>
                    {renderRows(groupRows)}
                  </React.Fragment>
                );
              })
            ) : renderRows(rows)}
            {rows.length === 0 && (
              <div className="text-center text-muted-foreground py-8 text-sm">No rows yet</div>
            )}
          </div>
        </div>
      </div>
      {overflowState.left && <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-background to-transparent" />}
      {overflowState.right && <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent" />}
      {overflowState.left && (
        <button onClick={() => scrollByCol(-1)} className="absolute left-1 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full bg-background border border-border shadow-md flex items-center justify-center opacity-0 group-hover/table:opacity-100 transition-opacity hover:bg-accent" aria-label="Scroll left">
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}
      {overflowState.right && (
        <button onClick={() => scrollByCol(1)} className="absolute right-1 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full bg-background border border-border shadow-md flex items-center justify-center opacity-0 group-hover/table:opacity-100 transition-opacity hover:bg-accent" aria-label="Scroll right">
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}


function GenericKanban({ database, rows, kanbanColumn, onEdit, allDatabases, allRows }: { database: Database; rows: DatabaseRow[]; kanbanColumn: DatabaseColumn; onEdit?: (r: DatabaseRow) => void; allDatabases?: Database[]; allRows?: DatabaseRow[] }) {
  const groups = kanbanColumn?.options || [];
  const scrollRef = useRef<HTMLDivElement>(null);
  const [overflowState, setOverflowState] = useState<{ left: boolean; right: boolean }>({ left: false, right: false });

  const updateOverflow = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const hasOverflow = el.scrollWidth > el.clientWidth + 1;
    setOverflowState({
      left: hasOverflow && el.scrollLeft > 4,
      right: hasOverflow && el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
    });
  }, []);

  useEffect(() => {
    updateOverflow();
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(updateOverflow);
    ro.observe(el);
    return () => ro.disconnect();
  }, [updateOverflow, groups.length, rows.length]);

  const onWheel = (e: React.WheelEvent) => {
    if (e.shiftKey && scrollRef.current) scrollRef.current.scrollLeft += e.deltaY;
  };
  const scrollByCol = (dir: -1 | 1) => scrollRef.current?.scrollBy({ left: dir * 300, behavior: "smooth" });

  return (
    <div className="relative group/board">
      <div ref={scrollRef} onScroll={updateOverflow} onWheel={onWheel} className="overflow-x-auto scrollbar-hide -mx-2 px-2 pb-2">
        <div className="flex gap-3 w-full">
          {groups.map(group => {
            const groupRows = rows.filter(r => r.values[kanbanColumn.id] === group);
            const color = `hsl(${getColor(group)})`;
            return (
              <div key={group} className="flex-1 min-w-[260px] max-w-[340px] shrink-0 rounded-xl p-2 flex flex-col bg-muted/30">
                <div className="sticky top-0 z-10 backdrop-blur-sm flex items-center gap-2 px-3 py-1.5 mb-2 rounded-lg bg-background/60">
                  <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-xs font-bold uppercase tracking-wider truncate" style={{ color }}>{group}</span>
                  <span className="ml-auto text-[10px] font-semibold rounded-full px-1.5 py-0.5 bg-background/60 text-muted-foreground">{groupRows.length}</span>
                </div>
                <div className="space-y-2 min-h-[80px] flex-1">
                  {groupRows.map(row => {
                    const otherCols = database.columns.filter(c => c.id !== "title" && c.id !== kanbanColumn.id && c.type !== "relation").slice(0, 3);
                    return (
                      <Card key={row.id} className="cursor-pointer hover:-translate-y-0.5 hover:shadow-lg transition-all overflow-hidden border-border/40" onClick={() => onEdit?.(row)}>
                        <div className="h-[3px] w-full" style={{ backgroundColor: color }} />
                        <CardContent className="p-2.5 space-y-1.5">
                          <p className="text-sm font-semibold leading-snug line-clamp-2">{row.values.title || "Untitled"}</p>
                          {otherCols.map(col => (
                            row.values[col.id] !== undefined && row.values[col.id] !== "" && (
                              <div key={col.id} className="flex items-center justify-between gap-2">
                                <span className="text-[10px] text-muted-foreground truncate">{col.name}</span>
                                <div className="shrink-0"><CellValue column={col} value={row.values[col.id]} allDatabases={allDatabases} allRows={allRows} /></div>
                              </div>
                            )
                          ))}
                        </CardContent>
                      </Card>
                    );
                  })}
                  {groupRows.length === 0 && <div className="text-[11px] text-muted-foreground/60 text-center py-6">No items</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {overflowState.left && <div className="pointer-events-none absolute left-0 top-0 bottom-2 w-8 bg-gradient-to-r from-background to-transparent" />}
      {overflowState.right && <div className="pointer-events-none absolute right-0 top-0 bottom-2 w-8 bg-gradient-to-l from-background to-transparent" />}
      {overflowState.left && (
        <button onClick={() => scrollByCol(-1)} className="absolute left-1 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full bg-background border border-border shadow-md flex items-center justify-center opacity-0 group-hover/board:opacity-100 transition-opacity hover:bg-accent" aria-label="Scroll left">
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}
      {overflowState.right && (
        <button onClick={() => scrollByCol(1)} className="absolute right-1 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full bg-background border border-border shadow-md flex items-center justify-center opacity-0 group-hover/board:opacity-100 transition-opacity hover:bg-accent" aria-label="Scroll right">
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function GenericList({ database, rows, onEdit, groupBy }: { database: Database; rows: DatabaseRow[]; onEdit?: (r: DatabaseRow) => void; groupBy: string | null }) {
  const statusCol = database.columns.find(c => (c.type === "select" || c.type === "status") && c.id !== "title");
  const personCol = database.columns.find(c => c.type === "person");
  const dateCol = database.columns.find(c => c.type === "date");
  const priorityCol = database.columns.find(c => c.id === "priority" || c.name?.toLowerCase() === "priority");

  const groupCol = groupBy ? database.columns.find(c => c.id === groupBy) : null;

  const renderItem = (row: DatabaseRow) => {
    const statusVal = statusCol ? row.values[statusCol.id] : null;
    const isDone = statusVal && ["Completed", "Done", "Closed", "Closing", "Approved", "Published", "Fixed"].includes(statusVal);
    const ringColor = statusVal ? `hsl(${getColor(statusVal)})` : "hsl(var(--muted-foreground))";

    return (
      <div
        key={row.id}
        className="flex items-center gap-3 px-4 py-3 rounded-xl bg-muted/30 cursor-pointer transition-colors duration-150 hover:bg-muted/50"
        style={{ minHeight: 56 }}
        onClick={() => onEdit?.(row)}
      >
        <div
          className="h-4 w-4 rounded-full shrink-0 border-2 flex items-center justify-center"
          style={{ borderColor: ringColor, backgroundColor: isDone ? ringColor : "transparent" }}
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{row.values.title || "Untitled"}</p>
        </div>
        {priorityCol && row.values[priorityCol.id] && (
          <div className="shrink-0"><CellValue column={priorityCol} value={row.values[priorityCol.id]} /></div>
        )}
        {statusCol && statusVal && (
          <Badge variant="outline" className="text-[10px] shrink-0 gap-1" style={{ borderColor: ringColor, color: ringColor }}>
            {statusVal}
          </Badge>
        )}
        {dateCol && row.values[dateCol.id] && (
          <span className="hidden sm:flex items-center gap-1 text-[11px] text-muted-foreground whitespace-nowrap">
            <Calendar className="h-3 w-3" />
            {row.values[dateCol.id]}
          </span>
        )}
        {personCol && row.values[personCol.id] && (
          <span className="text-xs text-muted-foreground hidden md:block max-w-[120px] truncate">{row.values[personCol.id]}</span>
        )}
      </div>
    );
  };

  if (groupCol && groupCol.options) {
    return (
      <div className="space-y-4">
        {groupCol.options.map(group => {
          const groupRows = rows.filter(r => r.values[groupBy!] === group);
          if (groupRows.length === 0) return null;
          return (
            <div key={group} className="rounded-xl bg-muted/20 p-3">
              <div className="flex items-center gap-2 px-1 py-1.5">
                <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: `hsl(${getColor(group)})` }} />
                <span className="text-sm font-semibold">{group}</span>
                <span className="text-xs text-muted-foreground ml-1">{groupRows.length}</span>
              </div>
              <div className="space-y-1.5 mt-2">{groupRows.map(renderItem)}</div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {rows.map(renderItem)}
      {rows.length === 0 && <p className="text-center text-muted-foreground py-12 text-sm">No rows yet</p>}
    </div>
  );
}
