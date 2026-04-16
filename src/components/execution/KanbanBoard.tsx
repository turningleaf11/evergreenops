import { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Repeat, Plus, Palette, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { KANBAN_CLASSES, KANBAN_COLORS, resolveColor, type KanbanColorName } from "@/lib/kanban-colors";

interface KanbanColumn {
  key: string;
  label: string;
  color: string; // named color — falls back to "slate"
}

interface KanbanBoardProps {
  columns: KanbanColumn[];
  items: any[];
  statusField: string;
  onItemClick: (item: any) => void;
  onStatusChange: (id: string, status: string) => void;
  getName: (uid: string | null) => string;
  ownerField: string;
  type: "project" | "task" | "row";
  onAddCard?: (status: string) => void;
  onEditColumnColor?: (key: string, newColor: KanbanColorName) => void;
}

const priorityStyles: Record<string, string> = {
  low: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  high: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  urgent: "bg-red-200 text-red-900 dark:bg-red-900/60 dark:text-red-200",
};

const priorityStripe: Record<string, string> = {
  low: "bg-green-500",
  medium: "bg-yellow-500",
  high: "bg-red-500",
  urgent: "bg-red-600",
};

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

function ColorSwatchPicker({ current, onPick }: { current: KanbanColorName; onPick: (c: KanbanColorName) => void }) {
  return (
    <div className="grid grid-cols-5 gap-1.5 p-1">
      {KANBAN_COLORS.map((c) => (
        <button
          key={c}
          onClick={() => onPick(c)}
          className={cn(
            "h-6 w-6 rounded-md flex items-center justify-center transition-transform hover:scale-110",
            KANBAN_CLASSES[c].swatch
          )}
          title={c}
        >
          {current === c && <Check className="h-3.5 w-3.5 text-white" />}
        </button>
      ))}
    </div>
  );
}

export default function KanbanBoard({
  columns, items, statusField, onItemClick, onStatusChange, getName, ownerField, type, onAddCard, onEditColumnColor,
}: KanbanBoardProps) {
  const [openPicker, setOpenPicker] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto -mx-2 px-2 pb-2">
      <div className="flex gap-3 min-w-max">
        {columns.map(col => {
          const colItems = items.filter(item => item[statusField] === col.key);
          const colorName = resolveColor(col.color);
          const cls = KANBAN_CLASSES[colorName];

          return (
            <div key={col.key} className={cn("w-[280px] shrink-0 rounded-xl p-2 flex flex-col", cls.columnBg)}>
              {/* Sticky tinted header bar */}
              <div className={cn(
                "sticky top-0 z-10 backdrop-blur-sm flex items-center gap-2 px-3 py-1.5 mb-2 rounded-lg group",
                cls.headerBg
              )}>
                <span className={cn("text-xs font-bold uppercase tracking-wider truncate", cls.headerText)}>
                  {col.label}
                </span>
                {onEditColumnColor && (
                  <Popover open={openPicker === col.key} onOpenChange={(o) => setOpenPicker(o ? col.key : null)}>
                    <PopoverTrigger asChild>
                      <button
                        className={cn(
                          "opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-background/40",
                          cls.headerText
                        )}
                        title="Change color"
                      >
                        <Palette className="h-3 w-3" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-1" align="start">
                      <ColorSwatchPicker
                        current={colorName}
                        onPick={(c) => { onEditColumnColor(col.key, c); setOpenPicker(null); }}
                      />
                    </PopoverContent>
                  </Popover>
                )}
                <span className={cn(
                  "ml-auto text-[10px] font-semibold rounded-full px-1.5 py-0.5 bg-background/60",
                  cls.headerText
                )}>
                  {colItems.length}
                </span>
              </div>

              <div
                className="space-y-2 min-h-[80px] flex-1"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  const id = e.dataTransfer.getData("text/plain");
                  if (id) onStatusChange(id, col.key);
                }}
              >
                {colItems.map(item => {
                  const ownerName = getName(item[ownerField]);
                  const stripeColor = item.priority ? priorityStripe[item.priority] || cls.stripe : cls.stripe;
                  return (
                    <Card
                      key={item.id}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData("text/plain", item.id)}
                      className="cursor-pointer hover:-translate-y-0.5 hover:shadow-lg transition-all overflow-hidden border-border/40"
                      onClick={() => onItemClick(item)}
                    >
                      <div className={cn("h-[3px] w-full", stripeColor)} />
                      <CardContent className="p-2.5 space-y-1.5">
                        <p className="text-sm font-semibold leading-snug flex items-start gap-1">
                          {item.is_recurring && <Repeat className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />}
                          <span className="line-clamp-2">{item.title}</span>
                        </p>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {item.priority && (
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[9px] capitalize border-0 rounded-full px-1.5 py-0 h-4",
                                priorityStyles[item.priority] || ""
                              )}
                            >
                              {item.priority}
                            </Badge>
                          )}
                          {item.due_date && (
                            <span className="flex items-center gap-0.5 text-[9px] text-muted-foreground">
                              <Calendar className="h-2.5 w-2.5" /> {item.due_date}
                            </span>
                          )}
                        </div>
                        {ownerName && ownerName !== "Unassigned" ? (
                          <div className="flex items-center gap-1.5 pt-0.5">
                            <div
                              className={cn(
                                "h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-medium text-white shrink-0",
                                hashColor(ownerName)
                              )}
                            >
                              {getInitials(ownerName)}
                            </div>
                            <span className="text-[10px] text-muted-foreground truncate">{ownerName}</span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-muted-foreground/70">Unassigned</span>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}

                {colItems.length === 0 && (
                  <div className="text-[11px] text-muted-foreground/60 text-center py-6">
                    No items
                  </div>
                )}

                {onAddCard && (
                  <button
                    onClick={() => onAddCard(col.key)}
                    className="w-full flex items-center justify-center gap-1 text-[11px] text-muted-foreground/70 hover:text-foreground hover:bg-background/60 rounded-md py-1.5 transition-colors"
                  >
                    <Plus className="h-3 w-3" /> Add card
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
