import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { FolderKanban, CheckSquare, MapPin, ChevronRight, Loader2 } from "lucide-react";
import { addDays, endOfWeek, format, isSameDay, isToday, isTomorrow, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";

const sb = supabase as any;

type PathItem = {
  kind: "project" | "task";
  id: string;
  title: string;
  due: Date;
  priority: string | null;
  status: string;
};

/**
 * Today's Path — the cockpit's roadmap thread.
 *
 * Vertical timeline of what's landing immediately (today), what's next (tomorrow),
 * and what's coming up (rest of this week). Each "station" is a day on the road.
 * Today is the active node; future days fade out as they get further away — the
 * journey metaphor without a literal road graphic.
 */
export function TodaysPathWidget() {
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
          .select("id, title, status, priority, due_date")
          .gte("due_date", todayIso)
          .lte("due_date", sundayIso)
          .neq("status", "completed")
          .neq("status", "done")
          .order("due_date", { ascending: true }),
        sb.from("tasks")
          .select("id, title, status, priority, due_date")
          .gte("due_date", todayIso)
          .lte("due_date", sundayIso)
          .neq("status", "done")
          .order("due_date", { ascending: true }),
      ]);
      if (cancelled) return;
      const merged: PathItem[] = [
        ...((projRows ?? []) as any[]).map((p) => ({
          kind: "project" as const, id: p.id, title: p.title, due: new Date(p.due_date), priority: p.priority, status: p.status,
        })),
        ...((taskRows ?? []) as any[]).map((t) => ({
          kind: "task" as const, id: t.id, title: t.title, due: new Date(t.due_date), priority: t.priority, status: t.status,
        })),
      ].sort((a, b) => a.due.getTime() - b.due.getTime());
      setItems(merged);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user, todayIso, sundayIso]);

  // Group items by station (today / tomorrow / rest of week)
  const stations = useMemo(() => {
    const todayItems: PathItem[] = [];
    const tomorrowItems: PathItem[] = [];
    const laterByDay = new Map<string, { date: Date; items: PathItem[] }>();
    for (const it of items) {
      if (isSameDay(it.due, today)) todayItems.push(it);
      else if (isTomorrow(it.due)) tomorrowItems.push(it);
      else {
        const key = format(it.due, "yyyy-MM-dd");
        if (!laterByDay.has(key)) laterByDay.set(key, { date: it.due, items: [] });
        laterByDay.get(key)!.items.push(it);
      }
    }
    return { todayItems, tomorrowItems, later: Array.from(laterByDay.values()) };
  }, [items, today]);

  const totalToday = stations.todayItems.length;
  const totalUpcoming = stations.tomorrowItems.length + stations.later.reduce((n, d) => n + d.items.length, 0);

  return (
    <section className="rounded-2xl border border-border/50 bg-card/80 p-6 elevation-1">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <MapPin className="h-3.5 w-3.5 text-primary" />
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Today's Path</h2>
        </div>
        <p className="text-[11px] text-muted-foreground/70">
          {totalToday} due today · {totalUpcoming} ahead this week
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
          <Loader2 className="h-3 w-3 animate-spin" /> Loading…
        </div>
      ) : totalToday + totalUpcoming === 0 ? (
        <div className="text-center py-8 space-y-2">
          <p className="text-sm text-muted-foreground/70">Clear road ahead.</p>
          <Link to="/execution" className="inline-block text-xs text-primary hover:underline">Plan the week in Execution →</Link>
        </div>
      ) : (
        <div className="relative">
          {/* The "road" — a single vertical gradient that fades as you go further out */}
          <div className="absolute left-[7px] top-2 bottom-2 w-px bg-gradient-to-b from-primary/60 via-primary/30 to-transparent" />

          <Station
            label="Today"
            date={today}
            tone="active"
            items={stations.todayItems}
            emptyHint="Nothing due — pick what matters most."
          />

          <Station
            label="Tomorrow"
            date={addDays(today, 1)}
            tone="next"
            items={stations.tomorrowItems}
          />

          {stations.later.map((d) => (
            <Station
              key={format(d.date, "yyyy-MM-dd")}
              label={format(d.date, "EEEE")}
              date={d.date}
              tone="future"
              items={d.items}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function Station({
  label, date, tone, items, emptyHint,
}: {
  label: string;
  date: Date;
  tone: "active" | "next" | "future";
  items: PathItem[];
  emptyHint?: string;
}) {
  const isActive = tone === "active";
  if (items.length === 0 && !emptyHint) return null;

  return (
    <div className={cn(
      "relative pl-7 pb-5 last:pb-0",
      tone === "future" && "opacity-70",
    )}>
      {/* Station dot */}
      <span
        className={cn(
          "absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full border-2 z-10",
          isActive ? "bg-primary border-primary shadow-[0_0_12px_hsl(var(--primary)/0.6)]"
            : tone === "next" ? "bg-card border-primary/60"
            : "bg-card border-border",
        )}
      />

      <div className="flex items-baseline gap-2 mb-1.5">
        <span className={cn(
          "text-[11px] font-semibold uppercase tracking-wider",
          isActive ? "text-primary" : "text-muted-foreground",
        )}>
          {label}
        </span>
        <span className="text-[10px] text-muted-foreground/50">{format(date, "MMM d")}</span>
      </div>

      {items.length === 0 ? (
        <p className="text-xs italic text-muted-foreground/50">{emptyHint}</p>
      ) : (
        <ul className="space-y-0.5">
          {items.slice(0, isActive ? 8 : 4).map((it) => (
            <li key={`${it.kind}-${it.id}`}>
              <Link
                to={it.kind === "project" ? `/projects/${it.id}` : `/tasks/${it.id}`}
                className="flex items-center gap-2 py-1 px-2 -mx-2 rounded-md hover:bg-muted/50 group transition-colors"
              >
                {it.kind === "project"
                  ? <FolderKanban className="h-3 w-3 text-sky-600 shrink-0" />
                  : <CheckSquare className="h-3 w-3 text-amber-600 shrink-0" />}
                <span className={cn(
                  "text-sm truncate flex-1",
                  isActive ? "text-foreground font-medium" : "text-foreground/80",
                )}>{it.title}</span>
                {it.priority === "high" && (
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" title="High priority" />
                )}
                <ChevronRight className="h-3 w-3 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </Link>
            </li>
          ))}
          {items.length > (isActive ? 8 : 4) && (
            <li className="pl-2 text-[11px] text-muted-foreground/60">+{items.length - (isActive ? 8 : 4)} more</li>
          )}
        </ul>
      )}
    </div>
  );
}
