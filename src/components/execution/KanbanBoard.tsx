import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Repeat } from "lucide-react";
import { cn } from "@/lib/utils";

interface KanbanColumn {
  key: string;
  label: string;
  color: string;
}

interface KanbanBoardProps {
  columns: KanbanColumn[];
  items: any[];
  statusField: string;
  onItemClick: (item: any) => void;
  onStatusChange: (id: string, status: string) => void;
  getName: (uid: string | null) => string;
  ownerField: string;
  type: "project" | "task";
}

const priorityStyles: Record<string, string> = {
  low: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  high: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  urgent: "bg-red-200 text-red-900 dark:bg-red-900/60 dark:text-red-200",
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

export default function KanbanBoard({
  columns, items, statusField, onItemClick, onStatusChange, getName, ownerField, type,
}: KanbanBoardProps) {
  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(220px, 1fr))` }}>
      {columns.map(col => {
        const colItems = items.filter(item => item[statusField] === col.key);
        return (
          <div key={col.key} className="space-y-2">
            <div className="flex items-center gap-2 px-1 pb-2">
              <div className={`h-2.5 w-2.5 rounded-full ${col.color}`} />
              <span className="text-sm font-medium">{col.label}</span>
              <span className="text-xs text-muted-foreground ml-auto">{colItems.length}</span>
            </div>
            <div className="space-y-2 min-h-[120px]">
              {colItems.map(item => {
                const ownerName = getName(item[ownerField]);
                return (
                  <Card
                    key={item.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => onItemClick(item)}
                  >
                    <CardContent className="p-3 space-y-2">
                      <p className="text-sm font-medium leading-snug flex items-center gap-1">
                        {item.is_recurring && <Repeat className="h-3 w-3 text-muted-foreground shrink-0" />}
                        {item.title}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
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
                        {item.due_date && (
                          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                            <Calendar className="h-2.5 w-2.5" /> {item.due_date}
                          </span>
                        )}
                      </div>
                      {/* Avatar */}
                      {ownerName && ownerName !== "Unassigned" ? (
                        <div className="flex items-center gap-1.5">
                          <div
                            className={cn(
                              "h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-medium text-white shrink-0",
                              hashColor(ownerName)
                            )}
                          >
                            {getInitials(ownerName)}
                          </div>
                          <span className="text-[11px] text-muted-foreground">{ownerName}</span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">Unassigned</span>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
              {colItems.length === 0 && (
                <div className="text-xs text-muted-foreground text-center py-8 border border-dashed rounded-md">
                  No items
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
