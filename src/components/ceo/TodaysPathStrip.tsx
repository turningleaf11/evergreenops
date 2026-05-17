import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { FolderKanban, CheckSquare, MapPin, ChevronRight } from "lucide-react";
import { endOfWeek, format, isToday, isTomorrow, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";

const sb = supabase as any;

type PathItem = {
  kind: "project" | "task";
  id: string;
  title: string;
  due: Date;
  priority: string | null;
};

/**
 * Slim horizontal Today's Path strip — sits inside the Today tab only.
 * Shows up to 5 items: today's items first, then a hint of upcoming days.
 * Designed to read like a road segment, not eat vertical real estate.
 */
export function TodaysPathStrip({ max = 5 }: { max?: number }) {
  const { user } = useAuth();
  const [items, setItems] = useState<PathItem[]>([]);
  const [loading, setLoading] = useState(true);

  const today = useMemo(() => startOfDay(new Date()), []);
  const sunday = useMemo(() => endOfWeek(today, { weekStartsOn: 1 }), [today]);
  const todayIso = format(today, "yyyy-MM-dd");
  const sundayIso = format(sunday, "yyyy-MM-dd");

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [{ data: projRows }, { data: taskRows }] = await Promise.all([
        sb.from("projects")
          .select("id, title, priority, due_date, status")
          .gte("due_date", todayIso)
          .lte("due_date", sundayIso)
          .neq("status", "completed")
          .order("due_date", { ascending: true })
          .limit(10),
        sb.from("tasks")
          .select("id, title, priority, due_date, status")
          .gte("due_date", todayIso)
          .lte("due_date", sundayIso)
          .neq("status", "done")
          .order("due_date", { ascending: true })
          .limit(10),
      ]);
      if (cancelled) return;
      const merged: PathItem[] = [
        ...((projRows ?? []) as any[]).map((p) => ({ kind: "project" as const, id: p.id, title: p.title, due: new Date(p.due_date), priority: p.priority })),
        ...((taskRows ?? []) as any[]).map((t) => ({ kind: "task" as const, id: t.id, title: t.title, due: new Date(t.due_date), priority: t.priority })),
      ].sort((a, b) => a.due.getTime() - b.due.getTime());
      setItems(merged);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user, todayIso, sundayIso]);

  if (loading) return null;

  const todayItems = items.filter((i) => isToday(i.due));
  const upcoming = items.filter((i) => !isToday(i.due));
  const shown = [...todayItems, ...upcoming].slice(0, max);
  const remaining = Math.max(0, items.length - shown.length);

  if (shown.length === 0) {
    return (
      <div className="rounded-xl border border-border/40 bg-card/40 px-4 py-2.5 flex items-center gap-3 text-xs text-muted-foreground">
        <MapPin className="h-3.5 w-3.5 text-primary/60 shrink-0" />
        <span className="font-semibold uppercase tracking-wider text-[10px] text-muted-foreground/70">Today's Path</span>
        <span className="text-muted-foreground/60">Clear road ahead.</span>
        <Link to="/execution" className="ml-auto text-primary hover:underline">Plan in Execution →</Link>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/40 bg-card/40 px-4 py-2.5 flex items-center gap-3 overflow-x-auto">
      <div className="flex items-center gap-1.5 shrink-0">
        <MapPin className="h-3.5 w-3.5 text-primary" />
        <span className="font-semibold uppercase tracking-wider text-[10px] text-muted-foreground/70">Today's Path</span>
      </div>

      <div className="h-4 w-px bg-border/60 shrink-0" />

      <ul className="flex items-center gap-1.5 min-w-0">
        {shown.map((it, idx) => {
          const isTodayItem = isToday(it.due);
          const dayLabel = isTodayItem ? "Today" : isTomorrow(it.due) ? "Tmr" : format(it.due, "EEE");
          return (
            <li key={`${it.kind}-${it.id}`} className="flex items-center gap-1.5 shrink-0">
              <Link
                to={it.kind === "project" ? `/projects/${it.id}` : `/tasks/${it.id}`}
                className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition-colors group",
                  isTodayItem
                    ? "bg-primary/10 border-primary/30 text-foreground hover:bg-primary/15"
                    : "bg-muted/30 border-border/40 text-foreground/80 hover:bg-muted/50",
                )}
                title={`${it.title} · ${format(it.due, "EEE MMM d")}`}
              >
                {it.kind === "project"
                  ? <FolderKanban className="h-3 w-3 text-sky-600 shrink-0" />
                  : <CheckSquare className="h-3 w-3 text-amber-600 shrink-0" />}
                <span className="max-w-[14ch] truncate">{it.title}</span>
                {it.priority === "high" && (
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" title="High priority" />
                )}
                <span className="text-[10px] text-muted-foreground shrink-0">· {dayLabel}</span>
              </Link>
              {idx < shown.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground/30 shrink-0" />}
            </li>
          );
        })}
      </ul>

      <Link
        to="/execution"
        className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground shrink-0"
      >
        {remaining > 0 ? `+${remaining} ahead` : "View all"} <ChevronRight className="h-3 w-3" />
      </Link>
    </div>
  );
}
