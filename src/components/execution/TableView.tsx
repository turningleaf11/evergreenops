import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Calendar, Repeat, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface TableViewProps {
  items: any[];
  type: "project" | "task";
  onItemClick: (item: any) => void;
  onStatusChange: (id: string, status: string) => void;
  getName: (uid: string | null) => string;
  statusOptions: { value: string; label: string }[];
  goals?: any[];
  projects?: any[];
}

const statusRingColors: Record<string, string> = {
  not_started: "border-muted-foreground text-muted-foreground",
  todo: "border-muted-foreground text-muted-foreground",
  in_progress: "border-blue-500 text-blue-500",
  done: "border-green-500 bg-green-500 text-white",
  blocked: "border-red-500 text-red-500",
};

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

function StatusCircle({ status, statusOptions, onStatusChange, itemId }: {
  status: string;
  statusOptions: { value: string; label: string }[];
  onStatusChange: (id: string, status: string) => void;
  itemId: string;
}) {
  const isDone = status === "done";
  const ringColor = statusRingColors[status] || statusRingColors.not_started;

  return (
    <Select value={status} onValueChange={v => onStatusChange(itemId, v)}>
      <SelectTrigger
        className="h-auto w-auto p-0 border-0 shadow-none bg-transparent focus:ring-0 focus:ring-offset-0"
        onClick={e => e.stopPropagation()}
      >
        <div className={cn(
          "h-4 w-4 rounded-full shrink-0 cursor-pointer transition-all hover:scale-125 flex items-center justify-center",
          isDone ? "border-2" : "border-2 bg-transparent",
          ringColor
        )}>
          {isDone && <Check className="h-2.5 w-2.5" />}
        </div>
      </SelectTrigger>
      <SelectContent>
        {statusOptions.map(s => (
          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/* HoverActions removed — drop-down/edit/archive icons no longer rendered on row hover */

export default function TableView({
  items, type, onItemClick, onStatusChange, getName, statusOptions, goals, projects,
}: TableViewProps) {
  const ownerField = type === "project" ? "owner_id" : "assigned_to";
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const grouped = statusOptions.map(s => ({
    ...s,
    items: items.filter(item => item.status === s.value),
  }));

  const toggleGroup = (key: string) =>
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="space-y-4">
      {grouped.map(group => {
        if (group.items.length === 0) return null;
        const dotColor = statusDotColors[group.value] || statusDotColors.not_started;
        const isOpen = !collapsed[group.value];

        return (
          <div key={group.value} className="rounded-xl bg-muted/20 p-3">
            <Collapsible open={isOpen} onOpenChange={() => toggleGroup(group.value)}>
              <CollapsibleTrigger className="flex items-center gap-2 px-1 py-1.5 w-full text-left group">
                <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", !isOpen && "-rotate-90")} />
                <div className={cn("h-2.5 w-2.5 rounded-full", dotColor)} />
                <span className="text-sm font-semibold">{group.label}</span>
                <span className="text-xs text-muted-foreground ml-1">{group.items.length}</span>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-1.5 mt-2">
                  {group.items.map(item => {
                    const ownerName = getName(item[ownerField]);
                    const goalTitle = goals?.find((g: any) => g.id === item.goal_id)?.title;
                    const projectTitle = projects?.find((p: any) => p.id === item.project_id)?.title;

                    return (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl bg-muted/30 cursor-pointer group/row transition-colors duration-150 hover:bg-muted/50"
                        style={{ minHeight: 56 }}
                        onClick={() => onItemClick(item)}
                      >
                        {/* Status circle */}
                        <StatusCircle
                          status={item.status}
                          statusOptions={statusOptions}
                          onStatusChange={onStatusChange}
                          itemId={item.id}
                        />

                        {/* Title + context */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate flex items-center gap-1.5">
                            {item.is_recurring && <Repeat className="h-3 w-3 text-muted-foreground shrink-0" />}
                            {item.title}
                          </p>
                          {(goalTitle || projectTitle) && (
                            <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                              {goalTitle}
                              {goalTitle && projectTitle && <span className="mx-1 opacity-50">›</span>}
                              {projectTitle}
                            </p>
                          )}
                        </div>

                        {/* Priority pill */}
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

                        {/* Due date */}
                        {item.due_date && (
                          <span className="hidden sm:flex items-center gap-1 text-[11px] text-muted-foreground whitespace-nowrap">
                            <Calendar className="h-3 w-3" />
                            {item.due_date}
                          </span>
                        )}

                        {/* Avatar */}
                        {ownerName && ownerName !== "Unassigned" && (
                          <div
                            className={cn(
                              "h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-medium text-white shrink-0",
                              hashColor(ownerName)
                            )}
                            title={ownerName}
                          >
                            {getInitials(ownerName)}
                          </div>
                        )}

                      </div>
                    );
                  })}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        );
      })}

      {items.length === 0 && (
        <div className="text-center text-muted-foreground py-12 text-sm">
          No items match your filters.
        </div>
      )}
    </div>
  );
}
