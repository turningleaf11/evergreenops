import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowUp, ArrowDown, Calendar, Repeat } from "lucide-react";
import { cn } from "@/lib/utils";

interface DataTableViewProps {
  items: any[];
  type: "project" | "task";
  onItemClick: (item: any) => void;
  onStatusChange: (id: string, status: string) => void;
  getName: (uid: string | null) => string;
  statusOptions: { value: string; label: string }[];
  goals?: any[];
  projects?: any[];
}

type SortCol = "title" | "status" | "priority" | "assignee" | "due_date";
type SortDir = "asc" | "desc";

const statusDotColors: Record<string, string> = {
  not_started: "bg-muted-foreground",
  todo: "bg-muted-foreground",
  in_progress: "bg-blue-500",
  done: "bg-green-500",
  blocked: "bg-red-500",
};

const priorityStyles: Record<string, string> = {
  low: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  high: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  urgent: "bg-red-200 text-red-900 dark:bg-red-900/60 dark:text-red-200",
};

const priorityOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

const avatarColors = [
  "bg-blue-500", "bg-emerald-500", "bg-violet-500", "bg-amber-500",
  "bg-rose-500", "bg-cyan-500", "bg-indigo-500", "bg-pink-500",
];

function getInitials(name: string) {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

function hashColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

export default function DataTableView({
  items, type, onItemClick, onStatusChange, getName, statusOptions, goals, projects,
}: DataTableViewProps) {
  const ownerField = type === "project" ? "owner_id" : "assigned_to";
  const [sortCol, setSortCol] = useState<SortCol>("title");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const toggleSort = (col: SortCol) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  };

  const sorted = [...items].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    switch (sortCol) {
      case "title": return dir * a.title.localeCompare(b.title);
      case "status": return dir * (a.status || "").localeCompare(b.status || "");
      case "priority": return dir * ((priorityOrder[a.priority] ?? 99) - (priorityOrder[b.priority] ?? 99));
      case "assignee": return dir * getName(a[ownerField]).localeCompare(getName(b[ownerField]));
      case "due_date": return dir * ((a.due_date || "9999") as string).localeCompare((b.due_date || "9999") as string);
      default: return 0;
    }
  });

  const SortIcon = ({ col }: { col: SortCol }) => {
    if (sortCol !== col) return null;
    return sortDir === "asc"
      ? <ArrowUp className="h-3 w-3 ml-1 inline" />
      : <ArrowDown className="h-3 w-3 ml-1 inline" />;
  };

  const colHeaderClass = "cursor-pointer select-none hover:text-foreground transition-colors text-xs font-medium";

  return (
    <div className="rounded-xl border border-border/50 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30 hover:bg-muted/30">
            <TableHead className={colHeaderClass} onClick={() => toggleSort("title")}>
              Name <SortIcon col="title" />
            </TableHead>
            <TableHead className={cn(colHeaderClass, "w-[130px]")} onClick={() => toggleSort("status")}>
              Status <SortIcon col="status" />
            </TableHead>
            <TableHead className={cn(colHeaderClass, "w-[100px]")} onClick={() => toggleSort("priority")}>
              Priority <SortIcon col="priority" />
            </TableHead>
            <TableHead className={cn(colHeaderClass, "w-[140px]")} onClick={() => toggleSort("assignee")}>
              Assignee <SortIcon col="assignee" />
            </TableHead>
            <TableHead className={cn(colHeaderClass, "w-[120px]")} onClick={() => toggleSort("due_date")}>
              Due Date <SortIcon col="due_date" />
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map(item => {
            const ownerName = getName(item[ownerField]);
            const dotColor = statusDotColors[item.status] || statusDotColors.not_started;
            const statusLabel = statusOptions.find(s => s.value === item.status)?.label || item.status;

            return (
              <TableRow
                key={item.id}
                className="cursor-pointer hover:bg-muted/40 transition-colors h-10"
                onClick={() => onItemClick(item)}
              >
                {/* Name */}
                <TableCell className="py-2">
                  <span className="text-sm font-medium flex items-center gap-1.5">
                    {item.is_recurring && <Repeat className="h-3 w-3 text-muted-foreground shrink-0" />}
                    <span className="truncate">{item.title}</span>
                  </span>
                </TableCell>

                {/* Status */}
                <TableCell className="py-2" onClick={e => e.stopPropagation()}>
                  <Select value={item.status} onValueChange={v => onStatusChange(item.id, v)}>
                    <SelectTrigger className="h-7 w-auto min-w-[90px] border-0 shadow-none bg-transparent px-1 text-xs focus:ring-0">
                      <div className="flex items-center gap-1.5">
                        <div className={cn("h-2 w-2 rounded-full shrink-0", dotColor)} />
                        <span>{statusLabel}</span>
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map(s => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>

                {/* Priority */}
                <TableCell className="py-2">
                  {item.priority && (
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] capitalize border-0 rounded-full px-2 py-0.5",
                        priorityStyles[item.priority] || ""
                      )}
                    >
                      {item.priority}
                    </Badge>
                  )}
                </TableCell>

                {/* Assignee */}
                <TableCell className="py-2">
                  {ownerName && ownerName !== "Unassigned" ? (
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-medium text-white shrink-0",
                          hashColor(ownerName)
                        )}
                      >
                        {getInitials(ownerName)}
                      </div>
                      <span className="text-xs text-muted-foreground truncate">{ownerName}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>

                {/* Due Date */}
                <TableCell className="py-2">
                  {item.due_date ? (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {item.due_date}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
          {items.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground py-12 text-sm">
                No items match your filters.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
