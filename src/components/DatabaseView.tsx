import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type { Database, DatabaseRow, DatabaseColumn } from "@/lib/mock-data";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, LayoutGrid, List, TableIcon, Plus, Pencil, Trash2, Link as LinkIcon, DollarSign, Mail, Phone, ExternalLink } from "lucide-react";
import DatabaseViewControls, { FilterDef, SortDef, applyFiltersAndSorts } from "@/components/DatabaseViewControls";
import { AddColumnPopover, ColumnHeaderMenu } from "@/components/ColumnManager";

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
  allDatabases?: Database[];
  allRows?: DatabaseRow[];
  onColumnsChange?: (columns: DatabaseColumn[]) => void;
  isAdmin?: boolean;
}

export default function DatabaseView({ database, rows, onAdd, onEdit, onDelete, allDatabases, allRows, onColumnsChange, isAdmin }: DatabaseViewProps) {
  const [view, setView] = useState<ViewMode>("table");
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
              <Button size="sm" variant="outline" onClick={onAdd} className="h-8 text-xs">
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
      return value ? <a href={value} target="_blank" rel="noopener" className="text-xs text-primary underline flex items-center gap-1" onClick={e => e.stopPropagation()}><ExternalLink className="h-3 w-3" />File</a> : <span className="text-muted-foreground">—</span>;
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

function GenericTable({ database, rows, onEdit, onDelete, allDatabases, allRows, groupBy, isAdmin, onAddColumn, onRenameColumn, onDeleteColumn, onMoveLeft, onMoveRight }: GenericTableProps) {
  const visibleCols = database.columns.filter(c => c.id !== "title");

  const renderRows = (rowsToRender: DatabaseRow[]) => (
    <>
      {rowsToRender.map(row => (
        <TableRow key={row.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onEdit?.(row)}>
          <TableCell className="font-medium">{row.values.title || "Untitled"}</TableCell>
          {visibleCols.map(col => (
            <TableCell key={col.id}><CellValue column={col} value={row.values[col.id]} allDatabases={allDatabases} allRows={allRows} /></TableCell>
          ))}
          {(onEdit || onDelete) && (
            <TableCell>
              <div className="flex gap-1">
                {onEdit && <button onClick={(e) => { e.stopPropagation(); onEdit(row); }} className="p-1 rounded hover:bg-muted"><Pencil className="h-3.5 w-3.5 text-muted-foreground" /></button>}
                {onDelete && <button onClick={(e) => { e.stopPropagation(); onDelete(row.id); }} className="p-1 rounded hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>}
              </div>
            </TableCell>
          )}
        </TableRow>
      ))}
    </>
  );

  const groupCol = groupBy ? database.columns.find(c => c.id === groupBy) : null;

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            {visibleCols.map((col, i) => (
              <TableHead key={col.id} className="group">
                {isAdmin ? (
                  <ColumnHeaderMenu
                    column={col}
                    index={i}
                    total={visibleCols.length}
                    onRename={onRenameColumn}
                    onDelete={onDeleteColumn}
                    onMoveLeft={onMoveLeft}
                    onMoveRight={onMoveRight}
                  />
                ) : col.name}
              </TableHead>
            ))}
            {isAdmin && (
              <TableHead className="w-10">
                <AddColumnPopover onAdd={onAddColumn} />
              </TableHead>
            )}
            {(onEdit || onDelete) && !isAdmin && <TableHead className="w-20" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {groupCol && groupCol.options ? (
            groupCol.options.map(group => {
              const groupRows = rows.filter(r => r.values[groupBy!] === group);
              if (groupRows.length === 0) return null;
              return (
                <React.Fragment key={group}>
                  <TableRow>
                    <TableCell colSpan={visibleCols.length + 2 + (isAdmin ? 1 : 0)} className="bg-muted/50 py-1.5">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: `hsl(${getColor(group)})` }} />
                        <span className="text-xs font-medium">{group}</span>
                        <span className="text-[10px] text-muted-foreground">({groupRows.length})</span>
                      </div>
                    </TableCell>
                  </TableRow>
                  {renderRows(groupRows)}
                </React.Fragment>
              );
            })
          ) : (
            renderRows(rows)
          )}
          {rows.length === 0 && (
            <TableRow><TableCell colSpan={visibleCols.length + 2 + (isAdmin ? 1 : 0)} className="text-center text-muted-foreground py-8">No rows yet</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </Card>
  );
}

// Need React import for Fragment
import React from "react";

function GenericKanban({ database, rows, kanbanColumn, onEdit, allDatabases, allRows }: { database: Database; rows: DatabaseRow[]; kanbanColumn: DatabaseColumn; onEdit?: (r: DatabaseRow) => void; allDatabases?: Database[]; allRows?: DatabaseRow[] }) {
  const groups = kanbanColumn?.options || [];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {groups.map(group => {
        const groupRows = rows.filter(r => r.values[kanbanColumn.id] === group);
        return (
          <div key={group} className="space-y-2">
            <div className="flex items-center gap-2 px-1 pb-2">
              <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: `hsl(${getColor(group)})` }} />
              <span className="text-sm font-medium">{group}</span>
              <span className="text-xs text-muted-foreground ml-auto">{groupRows.length}</span>
            </div>
            <div className="space-y-2 min-h-[200px]">
              {groupRows.map(row => {
                const otherCols = database.columns.filter(c => c.id !== "title" && c.id !== kanbanColumn.id && c.type !== "relation").slice(0, 3);
                return (
                  <Card key={row.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => onEdit?.(row)}>
                    <CardContent className="p-3 space-y-2">
                      <p className="text-sm font-medium leading-snug">{row.values.title || "Untitled"}</p>
                      {otherCols.map(col => (
                        row.values[col.id] !== undefined && (
                          <div key={col.id} className="flex items-center justify-between">
                            <span className="text-[10px] text-muted-foreground">{col.name}</span>
                            <CellValue column={col} value={row.values[col.id]} allDatabases={allDatabases} allRows={allRows} />
                          </div>
                        )
                      ))}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function GenericList({ database, rows, onEdit, groupBy }: { database: Database; rows: DatabaseRow[]; onEdit?: (r: DatabaseRow) => void; groupBy: string | null }) {
  const statusCol = database.columns.find(c => (c.type === "select" || c.type === "status") && c.id !== "title");
  const personCol = database.columns.find(c => c.type === "person");
  const dateCol = database.columns.find(c => c.type === "date");

  const groupCol = groupBy ? database.columns.find(c => c.id === groupBy) : null;

  const renderItem = (row: DatabaseRow) => (
    <div key={row.id} className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => onEdit?.(row)}>
      {statusCol && <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: `hsl(${getColor(row.values[statusCol.id] || "")})` }} />}
      <span className="text-sm font-medium flex-1 truncate">{row.values.title || "Untitled"}</span>
      {statusCol && row.values[statusCol.id] && (
        <Badge variant="outline" className="text-[10px] shrink-0" style={{ borderColor: `hsl(${getColor(row.values[statusCol.id])})`, color: `hsl(${getColor(row.values[statusCol.id])})` }}>
          {row.values[statusCol.id]}
        </Badge>
      )}
      {personCol && <span className="text-xs text-muted-foreground w-24 text-right truncate hidden sm:block">{row.values[personCol.id] || "—"}</span>}
      {dateCol && <span className="text-xs text-muted-foreground w-20 text-right hidden md:block">{row.values[dateCol.id] || "—"}</span>}
    </div>
  );

  if (groupCol && groupCol.options) {
    return (
      <div className="space-y-4">
        {groupCol.options.map(group => {
          const groupRows = rows.filter(r => r.values[groupBy!] === group);
          if (groupRows.length === 0) return null;
          return (
            <div key={group}>
              <div className="flex items-center gap-2 px-3 py-1.5 mb-1">
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: `hsl(${getColor(group)})` }} />
                <span className="text-xs font-medium">{group}</span>
                <span className="text-[10px] text-muted-foreground">({groupRows.length})</span>
              </div>
              {groupRows.map(renderItem)}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {rows.map(renderItem)}
      {rows.length === 0 && <p className="text-center text-muted-foreground py-8">No rows yet</p>}
    </div>
  );
}
