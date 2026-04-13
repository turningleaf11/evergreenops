import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, User, Repeat } from "lucide-react";

interface KanbanColumn {
  key: string;
  label: string;
  color: string; // tailwind bg class
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

const priorityColors: Record<string, string> = {
  low: "bg-green-100 text-green-800",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-red-100 text-red-800",
  urgent: "bg-red-200 text-red-900",
};

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
              {colItems.map(item => (
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
                        <Badge variant="outline" className={`text-[10px] ${priorityColors[item.priority] || ""}`}>
                          {item.priority}
                        </Badge>
                      )}
                      {item.due_date && (
                        <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                          <Calendar className="h-2.5 w-2.5" /> {item.due_date}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <User className="h-3 w-3" />
                      {getName(item[ownerField])}
                    </div>
                  </CardContent>
                </Card>
              ))}
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
