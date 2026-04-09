import { useState } from "react";
import type { Database, DatabaseRow, DatabaseColumn } from "@/lib/mock-data";
import { teamMembers } from "@/lib/mock-data";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, LayoutGrid, List, TableIcon, Plus, Pencil, Trash2 } from "lucide-react";

type ViewMode = "table" | "kanban" | "list";

const selectColors: Record<string, string> = {
  "Not Started": "220 10% 46%",
  "To Do": "220 10% 46%",
  "Draft": "220 10% 46%",
  "Open": "0 72% 51%",
  "In Progress": "220 65% 48%",
  "Investigating": "220 65% 48%",
  "In Review": "38 92% 50%",
  "Completed": "142 71% 45%",
  "Done": "142 71% 45%",
  "Fixed": "142 71% 45%",
  "Approved": "142 71% 45%",
  "Published": "142 71% 45%",
  "Closed": "220 10% 46%",
  "Blocked": "0 72% 51%",
  "Low": "220 10% 46%",
  "Medium": "38 92% 50%",
  "High": "25 95% 53%",
  "Urgent": "0 72% 51%",
  "Critical": "0 72% 51%",
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
}

export default function DatabaseView({ database, rows, onAdd, onEdit, onDelete }: DatabaseViewProps) {
  const [view, setView] = useState<ViewMode>("table");
  const [search, setSearch] = useState("");

  const titleCol = database.columns.find(c => c.id === "title");
  const filtered = rows.filter(row => {
    const title = (row.values.title || "").toString().toLowerCase();
    return title.includes(search.toLowerCase());
  });

  // Find the first select column for kanban grouping
  const kanbanColumn = database.columns.find(c => c.type === "select" && c.id !== "title") || database.columns[1];

  return (
    <div className="space-y-4">
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

      {view === "table" && <GenericTable database={database} rows={filtered} onEdit={onEdit} onDelete={onDelete} />}
      {view === "kanban" && <GenericKanban database={database} rows={filtered} kanbanColumn={kanbanColumn} onEdit={onEdit} />}
      {view === "list" && <GenericList database={database} rows={filtered} onEdit={onEdit} />}
    </div>
  );
}

function CellValue({ column, value }: { column: DatabaseColumn; value: any }) {
  if (value === undefined || value === null) return <span className="text-muted-foreground">—</span>;

  switch (column.type) {
    case "select":
      return (
        <Badge variant="outline" className="text-[10px]" style={{ borderColor: `hsl(${getColor(value)})`, color: `hsl(${getColor(value)})` }}>
          {value}
        </Badge>
      );
    case "multi_select":
      return (
        <div className="flex gap-1 flex-wrap">
          {(Array.isArray(value) ? value : []).map((v: string) => (
            <Badge key={v} variant="secondary" className="text-[10px] px-1.5 py-0">{v}</Badge>
          ))}
        </div>
      );
    case "progress":
      const pct = typeof value === "number" ? value : 0;
      return (
        <div className="flex items-center gap-2">
          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs text-muted-foreground">{pct}%</span>
        </div>
      );
    case "checkbox":
      return <span>{value ? "✓" : "—"}</span>;
    case "url":
      return <a href={value} className="text-xs text-primary underline truncate max-w-[150px] block">{value}</a>;
    case "date":
      return <span className="text-sm text-muted-foreground">{value}</span>;
    case "person":
      return <span className="text-sm">{value}</span>;
    default:
      return <span className="text-sm">{String(value)}</span>;
  }
}

function GenericTable({ database, rows, onEdit, onDelete }: { database: Database; rows: DatabaseRow[]; onEdit?: (r: DatabaseRow) => void; onDelete?: (id: string) => void }) {
  const visibleCols = database.columns.filter(c => c.id !== "title");

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            {visibleCols.map(col => (
              <TableHead key={col.id}>{col.name}</TableHead>
            ))}
            {(onEdit || onDelete) && <TableHead className="w-20" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(row => (
            <TableRow key={row.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onEdit?.(row)}>
              <TableCell className="font-medium">{row.values.title || "Untitled"}</TableCell>
              {visibleCols.map(col => (
                <TableCell key={col.id}>
                  <CellValue column={col} value={row.values[col.id]} />
                </TableCell>
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
          {rows.length === 0 && (
            <TableRow><TableCell colSpan={visibleCols.length + 2} className="text-center text-muted-foreground py-8">No rows yet</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </Card>
  );
}

function GenericKanban({ database, rows, kanbanColumn, onEdit }: { database: Database; rows: DatabaseRow[]; kanbanColumn: DatabaseColumn; onEdit?: (r: DatabaseRow) => void }) {
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
                const otherCols = database.columns.filter(c => c.id !== "title" && c.id !== kanbanColumn.id).slice(0, 3);
                return (
                  <Card key={row.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => onEdit?.(row)}>
                    <CardContent className="p-3 space-y-2">
                      <p className="text-sm font-medium leading-snug">{row.values.title || "Untitled"}</p>
                      {otherCols.map(col => (
                        row.values[col.id] !== undefined && (
                          <div key={col.id} className="flex items-center justify-between">
                            <span className="text-[10px] text-muted-foreground">{col.name}</span>
                            <CellValue column={col} value={row.values[col.id]} />
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

function GenericList({ database, rows, onEdit }: { database: Database; rows: DatabaseRow[]; onEdit?: (r: DatabaseRow) => void }) {
  const statusCol = database.columns.find(c => c.type === "select" && c.id !== "title");
  const personCol = database.columns.find(c => c.type === "person");
  const dateCol = database.columns.find(c => c.type === "date");

  return (
    <div className="space-y-1">
      {rows.map(row => (
        <div key={row.id} className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => onEdit?.(row)}>
          {statusCol && (
            <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: `hsl(${getColor(row.values[statusCol.id] || "")})` }} />
          )}
          <span className="text-sm font-medium flex-1 truncate">{row.values.title || "Untitled"}</span>
          {statusCol && row.values[statusCol.id] && (
            <Badge variant="outline" className="text-[10px] shrink-0" style={{ borderColor: `hsl(${getColor(row.values[statusCol.id])})`, color: `hsl(${getColor(row.values[statusCol.id])})` }}>
              {row.values[statusCol.id]}
            </Badge>
          )}
          {personCol && <span className="text-xs text-muted-foreground w-24 text-right truncate hidden sm:block">{row.values[personCol.id] || "—"}</span>}
          {dateCol && <span className="text-xs text-muted-foreground w-20 text-right hidden md:block">{row.values[dateCol.id] || "—"}</span>}
        </div>
      ))}
      {rows.length === 0 && <p className="text-center text-muted-foreground py-8">No rows yet</p>}
    </div>
  );
}
