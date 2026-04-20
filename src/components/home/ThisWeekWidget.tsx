import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CalendarDays } from "lucide-react";
import { startOfWeek, addDays, format, isSameDay } from "date-fns";
import { cn } from "@/lib/utils";
import { getHolidaysInRange } from "@/lib/us-holidays";

interface WeekEvent {
  date: Date;
  label: string;
  kind: "birthday" | "anniversary" | "announcement" | "holiday" | "meeting";
}

const dotClass: Record<WeekEvent["kind"], string> = {
  birthday: "bg-pink-500",
  anniversary: "bg-amber-500",
  announcement: "bg-primary",
  holiday: "bg-emerald-500",
  meeting: "bg-violet-500",
};

const FEDERAL_KEY = "us_federal_holidays_enabled";

export function ThisWeekWidget() {
  const [events, setEvents] = useState<WeekEvent[]>([]);
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekEnd = days[6];

  useEffect(() => {
    const load = async () => {
      const collected: WeekEvent[] = [];

      // Birthdays + anniversaries
      const { data: profiles } = await supabase
        .from("profiles")
        .select("full_name, birthday, start_date");

      profiles?.forEach((p: any) => {
        const checkAnnual = (raw: string | null, kind: "birthday" | "anniversary") => {
          if (!raw) return;
          const d = new Date(raw);
          if (isNaN(d.getTime())) return;
          for (const day of days) {
            if (d.getMonth() === day.getMonth() && d.getDate() === day.getDate()) {
              collected.push({
                date: day,
                label: kind === "birthday"
                  ? `${p.full_name || "Teammate"}'s birthday`
                  : `${p.full_name || "Teammate"}'s work anniversary`,
                kind,
              });
            }
          }
        };
        checkAnnual(p.birthday, "birthday");
        checkAnnual(p.start_date, "anniversary");
      });

      // Announcements
      const { data: anns } = await supabase
        .from("announcements")
        .select("title, created_at")
        .gte("created_at", weekStart.toISOString())
        .lte("created_at", addDays(weekEnd, 1).toISOString());
      anns?.forEach((a: any) => {
        collected.push({ date: new Date(a.created_at), label: a.title, kind: "announcement" });
      });

      // US Federal holidays
      const fedEnabled = localStorage.getItem(FEDERAL_KEY) !== "false";
      const fedHolidays = getHolidaysInRange(weekStart, addDays(weekEnd, 1), fedEnabled);
      fedHolidays.forEach((h) => {
        collected.push({ date: h.date, label: h.name, kind: "holiday" });
      });

      // Workspace custom holidays
      const { data: customH } = await supabase
        .from("workspace_holidays")
        .select("name, date, is_recurring");
      customH?.forEach((h: any) => {
        const d = new Date(h.date + "T00:00:00");
        if (h.is_recurring) {
          for (const day of days) {
            if (d.getMonth() === day.getMonth() && d.getDate() === day.getDate()) {
              collected.push({ date: day, label: h.name, kind: "holiday" });
            }
          }
        } else if (d >= weekStart && d <= addDays(weekEnd, 1)) {
          collected.push({ date: d, label: h.name, kind: "holiday" });
        }
      });

      // Meetings (this week)
      const { data: meetings } = await supabase
        .from("meetings")
        .select("title, started_at")
        .gte("started_at", weekStart.toISOString())
        .lte("started_at", addDays(weekEnd, 1).toISOString());
      meetings?.forEach((m: any) => {
        if (!m.started_at) return;
        collected.push({ date: new Date(m.started_at), label: m.title, kind: "meeting" });
      });

      setEvents(collected);
    };
    load();
  }, []);

  const upcoming = events
    .filter((e) => e.date >= new Date(today.getFullYear(), today.getMonth(), today.getDate()))
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 4);

  return (
    <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">This Week</h3>
        </div>
        <span className="text-[10px] text-muted-foreground">
          {format(weekStart, "MMM d")} – {format(weekEnd, "MMM d")}
        </span>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-3">
        {days.map((d) => {
          const dayEvents = events.filter((e) => isSameDay(e.date, d));
          const isToday = isSameDay(d, today);
          return (
            <div
              key={d.toISOString()}
              className={cn(
                "flex flex-col items-center gap-1 py-2 rounded-lg",
                isToday && "bg-primary/10"
              )}
            >
              <span className="text-[9px] uppercase text-muted-foreground tracking-wide">
                {format(d, "EEE")}
              </span>
              <span className={cn(
                "text-sm font-medium tabular-nums",
                isToday && "text-primary font-bold"
              )}>
                {format(d, "d")}
              </span>
              <div className="flex gap-0.5 h-1.5">
                {dayEvents.slice(0, 3).map((e, i) => (
                  <span key={i} className={cn("h-1.5 w-1.5 rounded-full", dotClass[e.kind])} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="space-y-1.5 border-t border-border/40 pt-3">
        {upcoming.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-2">
            Quiet week — no birthdays, holidays, or meetings.
          </p>
        ) : (
          upcoming.map((e, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", dotClass[e.kind])} />
              <span className="text-muted-foreground tabular-nums shrink-0 w-10">
                {format(e.date, "EEE d")}
              </span>
              <span className="truncate">{e.label}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
