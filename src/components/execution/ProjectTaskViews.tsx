// ProjectTaskViews — the addable lenses over a project's tasks.
//
// Each is a different rendering of the SAME task list (the List view is the
// built-in; these are what "+ Add view" creates). They share the project's
// tasks and the same click-through to the task peek.

import { useMemo, useState } from "react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, addMonths } from "date-fns";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import KanbanBoard from "@/components/execution/KanbanBoard";
import { PriorityPill } from "@/components/primitives";
import { cn } from "@/lib/utils";

export type ProjectViewType = "board" | "calendar" | "timeline";

interface CommonProps {
  tasks: any[];
  profiles: { user_id: string; full_name: string | null; avatar_url?: string | null }[];
  getName: (uid: string | null) => string;
  onItemClick: (task: any) => void;
  onStatusChange: (id: string, status: string) => void;
  onFieldChange?: (id: string, patch: Record<string, any>) => void;
  unreadIds?: Set<string>;
}

const TASK_COLUMNS = [
  { key: "todo", label: "To Do", color: "slate" },
  { key: "in_progress", label: "In Progress", color: "blue" },
  { key: "blocked", label: "Blocked", color: "red" },
  { key: "done", label: "Done", color: "green" },
];

function parseDue(d: string | null | undefined): Date | null {
  if (!d) return null;
  const parsed = new Date(`${d}T00:00:00`);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/** Board — tasks grouped into status columns (reuses the shared KanbanBoard). */
export function ProjectBoardView({ tasks, profiles, getName, onItemClick, onStatusChange, onFieldChange, unreadIds }: CommonProps) {
  return (
    <KanbanBoard
      columns={TASK_COLUMNS}
      items={tasks}
      statusField="status"
      ownerField="assigned_to"
      type="task"
      profiles={profiles}
      getName={getName}
      onItemClick={onItemClick}
      onStatusChange={onStatusChange}
      onPriorityChange={onFieldChange ? (id, v) => onFieldChange(id, { priority: v }) : undefined}
      onDateChange={onFieldChange ? (id, v) => onFieldChange(id, { due_date: v }) : undefined}
      unreadIds={unreadIds}
    />
  );
}

/** Calendar — a month grid with tasks sitting on their due date. */
export function ProjectCalendarView({ tasks, onItemClick }: Pick<CommonProps, "tasks" | "onItemClick">) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month));
    const end = endOfWeek(endOfMonth(month));
    const out: Date[] = [];
    for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
    return out;
  }, [month]);

  const byDay = useMemo(() => {
    const map = new Map<string, any[]>();
    tasks.forEach((t) => {
      const due = parseDue(t.due_date);
      if (!due) return;
      const key = format(due, "yyyy-MM-dd");
      map.set(key, [...(map.get(key) || []), t]);
    });
    return map;
  }, [tasks]);

  const undated = tasks.filter((t) => !t.due_date);

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <button onClick={() => setMonth((m) => addMonths(m, -1))} className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-accent text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold">{format(month, "MMMM yyyy")}</span>
        <button onClick={() => setMonth((m) => addMonths(m, 1))} className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-accent text-muted-foreground hover:text-foreground">
          <ChevronRight className="h-4 w-4" />
        </button>
        <button onClick={() => setMonth(startOfMonth(new Date()))} className="ml-1 text-xs text-muted-foreground hover:text-foreground">
          Today
        </button>
      </div>

      <div className="grid grid-cols-7 gap-px bg-border/40 rounded-xl overflow-hidden border border-border/40">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="bg-muted/30 px-2 py-1.5 text-[10px] uppercase tracking-wide text-muted-foreground text-center">
            {d}
          </div>
        ))}
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const items = byDay.get(key) || [];
          const inMonth = isSameMonth(day, month);
          const today = isSameDay(day, new Date());
          return (
            <div key={key} className={cn("bg-background min-h-[92px] p-1.5 space-y-1", !inMonth && "opacity-40")}>
              <div className={cn("text-[11px] font-medium", today ? "text-primary" : "text-muted-foreground")}>
                {format(day, "d")}
              </div>
              {items.map((t) => (
                <button
                  key={t.id}
                  onClick={() => onItemClick(t)}
                  className="w-full text-left text-[11px] rounded-md px-1.5 py-1 bg-primary/10 text-foreground hover:bg-primary/20 transition-colors truncate"
                  title={t.title}
                >
                  {t.title}
                </button>
              ))}
            </div>
          );
        })}
      </div>

      {undated.length > 0 && (
        <div className="mt-4">
          <p className="text-xs text-muted-foreground mb-1.5">No due date ({undated.length})</p>
          <div className="flex gap-2 flex-wrap">
            {undated.map((t) => (
              <button
                key={t.id}
                onClick={() => onItemClick(t)}
                className="text-xs px-2.5 py-1 rounded-md border border-border/50 bg-muted/30 hover:bg-accent/50 transition-colors"
              >
                {t.title}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Timeline — the next stretch of days, tasks sitting on their due date. */
export function ProjectTimelineView({ tasks, onItemClick }: Pick<CommonProps, "tasks" | "onItemClick">) {
  const [offset, setOffset] = useState(0);
  const DAYS = 14;

  const start = useMemo(() => addDays(new Date(), offset), [offset]);
  const days = useMemo(() => Array.from({ length: DAYS }, (_, i) => addDays(start, i)), [start]);

  const byDay = useMemo(() => {
    const map = new Map<string, any[]>();
    tasks.forEach((t) => {
      const due = parseDue(t.due_date);
      if (!due) return;
      const key = format(due, "yyyy-MM-dd");
      map.set(key, [...(map.get(key) || []), t]);
    });
    return map;
  }, [tasks]);

  const undated = tasks.filter((t) => !t.due_date);

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <button onClick={() => setOffset((o) => o - 7)} className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-accent text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold">
          {format(days[0], "MMM d")} – {format(days[days.length - 1], "MMM d")}
        </span>
        <button onClick={() => setOffset((o) => o + 7)} className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-accent text-muted-foreground hover:text-foreground">
          <ChevronRight className="h-4 w-4" />
        </button>
        <button onClick={() => setOffset(0)} className="ml-1 text-xs text-muted-foreground hover:text-foreground">
          Today
        </button>
      </div>

      <div className="overflow-x-auto">
        <div className="flex gap-px bg-border/40 rounded-xl overflow-hidden border border-border/40 min-w-max">
          {days.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const items = byDay.get(key) || [];
            const today = isSameDay(day, new Date());
            return (
              <div key={key} className="bg-background w-[150px] shrink-0 flex flex-col">
                <div className={cn("px-2 py-2 text-center border-b border-border/40", today && "bg-primary/[0.06]")}>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{format(day, "EEE")}</div>
                  <div className={cn("text-sm font-semibold", today ? "text-primary" : "text-foreground")}>{format(day, "d")}</div>
                </div>
                <div className="flex-1 p-1.5 space-y-1.5 min-h-[140px]">
                  {items.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => onItemClick(t)}
                      className="w-full text-left rounded-lg border border-border/50 bg-card p-2 hover:bg-accent/40 transition-colors space-y-1.5"
                    >
                      <p className="text-xs font-medium leading-snug line-clamp-2">{t.title}</p>
                      {t.priority && <PriorityPill value={t.priority} size="sm" onChange={() => {}} />}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {undated.length > 0 && (
        <div className="mt-4">
          <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" /> No due date ({undated.length})
          </p>
          <div className="flex gap-2 flex-wrap">
            {undated.map((t) => (
              <button
                key={t.id}
                onClick={() => onItemClick(t)}
                className="text-xs px-2.5 py-1 rounded-md border border-border/50 bg-muted/30 hover:bg-accent/50 transition-colors"
              >
                {t.title}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
