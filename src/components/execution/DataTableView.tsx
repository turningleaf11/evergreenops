import { useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, ArrowDown, Repeat, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useColumnWidths } from "@/hooks/useColumnWidths";
import { InlineText, InlineSelect, InlineAssignee, InlineDate } from "@/components/shared/InlineCell";
import { UnreadDot } from "@/components/primitives";

interface DataTableViewProps {
  items: any[];
  type: "project" | "task";
  onItemClick: (item: any) => void;
  onStatusChange: (id: string, status: string) => void;
  onUpdate?: (id: string, patch: Record<string, any>) => void;
  getName: (uid: string | null) => string;
  statusOptions: { value: string; label: string }[];
  profiles?: { user_id: string; full_name: string | null }[];
  goals?: any[];
  projects?: any[];
  unreadIds?: Set<string>;
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

const priorityOptions = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

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

type ColDef = { id: SortCol; label: string; defaultWidth: number; minWidth: number };
const COLUMNS: ColDef[] = [
  { id: "title",    label: "Name",     defaultWidth: 360, minWidth: 160 },
  { id: "status",   label: "Status",   defaultWidth: 150, minWidth: 110 },
  { id: "priority", label: "Priority", defaultWidth: 120, minWidth: 90 },
  { id: "assignee", label: "Assignee", defaultWidth: 180, minWidth: 130 },
  { id: "due_date", label: "Due Date", defaultWidth: 160, minWidth: 110 },
];

export default function DataTableView({
  items, type, onItemClick, onStatusChange, onUpdate, getName, statusOptions, profiles = [], unreadIds,
}: DataTableViewProps) {
  const ownerField = type === "project" ? "owner_id" : "assigned_to";
  const [sortCol, setSortCol] = useState<SortCol>("title");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const viewKey = `execution-${type}`;
  const { getWidth: getStoredWidth, setWidth } = useColumnWidths(viewKey);
  const getWidth = (id: string, fallback: number) => {
    const stored = getStoredWidth(id);
    return stored === 160 ? fallback : stored;
  };

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

  // Use 1fr on the last data column to absorb extra space; explicit widths elsewhere.
  // The "open" affordance lives at the trailing edge of the Name cell (no extra column).
  const gridTemplate = COLUMNS.map((c, i) => {
    const w = getWidth(c.id, c.defaultWidth);
    const stored = getStoredWidth(c.id);
    const userSet = stored !== 160;
    if (i === COLUMNS.length - 1 && !userSet) return `minmax(${c.minWidth}px, 1fr)`;
    return `minmax(${c.minWidth}px, ${w}px)`;
  }).join(" ");

  const startResize = useCallback((colId: string, startX: number, startWidth: number) => {
    const onMove = (e: PointerEvent) => {
      const next = startWidth + (e.clientX - startX);
      setWidth(colId, next);
    };
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

  return (
    <div className="rounded-xl border border-border/50 overflow-hidden">
      <div className="overflow-x-auto">
        <div className="min-w-full">
          {/* Header */}
          <div
            className="grid bg-muted/30 border-b border-border/50"
            style={{ gridTemplateColumns: gridTemplate }}
          >
            {COLUMNS.map((c) => (
              <div
                key={c.id}
                className="relative flex items-center px-3 py-2.5 text-xs font-medium text-muted-foreground select-none cursor-pointer hover:text-foreground transition-colors"
                onClick={() => toggleSort(c.id)}
              >
                <span className="truncate">{c.label}</span>
                <SortIcon col={c.id} />
                <div
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    startResize(c.id, e.clientX, getWidth(c.id, c.defaultWidth));
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-primary/40 active:bg-primary/60 transition-colors"
                />
              </div>
            ))}
          </div>

          {/* Body */}
          <div className="divide-y divide-border/30">
            {sorted.map((item) => {
              const ownerName = getName(item[ownerField]);
              return (
                <div
                  key={item.id}
                  className="grid items-center cursor-pointer hover:bg-muted/30 transition-colors group"
                  style={{ gridTemplateColumns: gridTemplate }}
                  onClick={() => onItemClick(item)}
                >
                  {/* Name (inline editable) + open affordance at the name's trailing edge */}
                  <div className="px-3 py-2.5 min-w-0 flex items-center gap-1.5">
                    {unreadIds?.has(item.id) && <UnreadDot />}
                    {item.is_recurring && <Repeat className="h-3 w-3 text-muted-foreground shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <InlineText
                        value={item.title}
                        onChange={(v) => onUpdate?.(item.id, { title: v })}
                        className="font-medium"
                      />
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); onItemClick(item); }}
                      className="shrink-0 p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100"
                      title="Open"
                    >
                      <Maximize2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Status */}
                  <div className="px-3 py-2.5 min-w-0">
                    <InlineSelect
                      value={item.status}
                      onChange={(v) => onStatusChange(item.id, v)}
                      options={statusOptions}
                      renderDisplay={(v, label) => (
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div className={cn("h-2 w-2 rounded-full shrink-0", statusDotColors[v] || statusDotColors.not_started)} />
                          <span className="truncate text-xs">{label || v}</span>
                        </div>
                      )}
                      renderOption={(opt) => (
                        <div className="flex items-center gap-2">
                          <div className={cn("h-2 w-2 rounded-full", statusDotColors[opt.value] || statusDotColors.not_started)} />
                          <span>{opt.label}</span>
                        </div>
                      )}
                    />
                  </div>

                  {/* Priority */}
                  <div className="px-3 py-2.5 min-w-0">
                    <InlineSelect
                      value={item.priority || ""}
                      onChange={(v) => onUpdate?.(item.id, { priority: v })}
                      options={priorityOptions}
                      renderDisplay={(v) =>
                        v ? (
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] capitalize border-0 rounded-full px-2 py-0.5",
                              priorityStyles[v] || "",
                            )}
                          >
                            {v}
                          </Badge>
                        ) : <span className="text-xs text-muted-foreground/60">—</span>
                      }
                      renderOption={(opt) => (
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] capitalize border-0 rounded-full px-2 py-0.5",
                            priorityStyles[opt.value] || "",
                          )}
                        >
                          {opt.label}
                        </Badge>
                      )}
                    />
                  </div>

                  {/* Assignee */}
                  <div className="px-3 py-2.5 min-w-0">
                    <InlineAssignee
                      value={item[ownerField]}
                      profiles={profiles}
                      onChange={(uid) => onUpdate?.(item.id, { [ownerField]: uid })}
                      renderDisplay={(uid) =>
                        uid && ownerName !== "Unassigned" ? (
                          <div className="flex items-center gap-2 min-w-0">
                            <div
                              className={cn(
                                "h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-medium text-white shrink-0",
                                hashColor(ownerName),
                              )}
                            >
                              {getInitials(ownerName)}
                            </div>
                            <span className="text-xs text-muted-foreground truncate">{ownerName}</span>
                          </div>
                        ) : <span className="text-xs text-muted-foreground/60">Unassigned</span>
                      }
                    />
                  </div>

                  {/* Due Date */}
                  <div className="px-3 py-2.5 min-w-0">
                    <InlineDate
                      value={item.due_date}
                      onChange={(v) => onUpdate?.(item.id, { due_date: v })}
                    />
                  </div>

                </div>
              );
            })}
            {items.length === 0 && (
              <div className="text-center text-muted-foreground py-12 text-sm">
                No items match your filters.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
