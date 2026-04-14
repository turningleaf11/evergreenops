import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Calendar, Repeat } from "lucide-react";
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

const statusColors: Record<string, { bg: string; text: string; border: string }> = {
  not_started: { bg: "bg-muted/60 dark:bg-muted/30", text: "text-muted-foreground", border: "border-l-muted-foreground" },
  todo: { bg: "bg-muted/60 dark:bg-muted/30", text: "text-muted-foreground", border: "border-l-muted-foreground" },
  in_progress: { bg: "bg-blue-50 dark:bg-blue-950/40", text: "text-blue-700 dark:text-blue-300", border: "border-l-blue-500" },
  done: { bg: "bg-green-50 dark:bg-green-950/40", text: "text-green-700 dark:text-green-300", border: "border-l-green-500" },
  blocked: { bg: "bg-red-50 dark:bg-red-950/40", text: "text-red-700 dark:text-red-300", border: "border-l-red-500" },
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
    <div className="space-y-3">
      {grouped.map(group => {
        if (group.items.length === 0) return null;
        const colors = statusColors[group.value] || statusColors.not_started;
        const isOpen = !collapsed[group.value];

        return (
          <Collapsible key={group.value} open={isOpen} onOpenChange={() => toggleGroup(group.value)}>
            <CollapsibleTrigger className="flex items-center gap-2 px-1 py-1.5 w-full text-left group">
              <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", !isOpen && "-rotate-90")} />
              <div className={cn("h-2 w-2 rounded-full", colors.border.replace("border-l-", "bg-"))} />
              <span className="text-sm font-medium">{group.label}</span>
              <span className="text-xs text-muted-foreground">{group.items.length}</span>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-1 mt-1">
                {group.items.map(item => {
                  const ownerName = getName(item[ownerField]);
                  const goalTitle = goals?.find((g: any) => g.id === item.goal_id)?.title;
                  const projectTitle = projects?.find((p: any) => p.id === item.project_id)?.title;

                  return (
                    <div
                      key={item.id}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border/40 cursor-pointer",
                        "hover:bg-accent/30 transition-colors group/row",
                        "border-l-[3px]",
                        colors.border
                      )}
                      onClick={() => onItemClick(item)}
                    >
                      {/* Title + context */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate flex items-center gap-1.5">
                          {item.is_recurring && <Repeat className="h-3 w-3 text-muted-foreground shrink-0" />}
                          {item.title}
                        </p>
                        {(goalTitle || projectTitle) && (
                          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                            {goalTitle && `🎯 ${goalTitle}`}
                            {goalTitle && projectTitle && " · "}
                            {projectTitle && `📁 ${projectTitle}`}
                          </p>
                        )}
                      </div>

                      {/* Status pill */}
                      <Select value={item.status} onValueChange={v => onStatusChange(item.id, v)}>
                        <SelectTrigger
                          className={cn(
                            "h-6 w-auto gap-1 rounded-full border-0 px-2.5 text-[11px] font-medium shadow-none",
                            colors.bg, colors.text
                          )}
                          onClick={e => e.stopPropagation()}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {statusOptions.map(s => (
                            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

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
