import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDepartments } from "@/contexts/DepartmentsContext";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { CheckSquare, ArrowRight, Circle, CheckCircle2 } from "lucide-react";
import { format, isToday, isPast, parseISO, isFuture } from "date-fns";
import { cn } from "@/lib/utils";
import DetailDrawer from "@/components/DetailDrawer";
import { toast } from "@/hooks/use-toast";

type Tab = "today" | "overdue" | "upcoming";

interface Task {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  priority: string;
}

export function MyTasksWidget() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tab, setTab] = useState<Tab>("today");

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("tasks")
      .select("id, title, status, due_date, priority")
      .eq("assigned_to", user.id)
      .neq("status", "done")
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(50);
    if (data) setTasks(data as Task[]);
  };

  useEffect(() => {
    load();
  }, [user?.id]);

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (!t.due_date) return tab === "upcoming";
      const d = parseISO(t.due_date);
      if (tab === "today") return isToday(d);
      if (tab === "overdue") return isPast(d) && !isToday(d);
      if (tab === "upcoming") return isFuture(d) && !isToday(d);
      return false;
    });
  }, [tasks, tab]);

  const counts = useMemo(() => {
    const c = { today: 0, overdue: 0, upcoming: 0 };
    tasks.forEach((t) => {
      if (!t.due_date) { c.upcoming++; return; }
      const d = parseISO(t.due_date);
      if (isToday(d)) c.today++;
      else if (isPast(d)) c.overdue++;
      else c.upcoming++;
    });
    return c;
  }, [tasks]);

  const toggle = async (id: string, current: string) => {
    const next = current === "done" ? "todo" : "done";
    setTasks((prev) => prev.filter((t) => t.id !== id));
    await supabase.from("tasks").update({ status: next }).eq("id", id);
  };

  const tabs: { key: Tab; label: string; count: number; tone: string }[] = [
    { key: "today", label: "Today", count: counts.today, tone: "text-primary" },
    { key: "overdue", label: "Overdue", count: counts.overdue, tone: "text-red-500" },
    { key: "upcoming", label: "Upcoming", count: counts.upcoming, tone: "text-muted-foreground" },
  ];

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-muted-foreground/70" /> My Tasks
          </h2>
          <Link to="/execution" className="text-xs text-primary hover:underline flex items-center gap-1">
            All <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="flex gap-1 rounded-lg bg-muted/40 p-0.5">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex-1 px-2 py-1 rounded-md text-[11px] font-medium transition-all flex items-center justify-center gap-1",
                tab === t.key
                  ? "bg-card shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
              {t.count > 0 && (
                <span className={cn("text-[10px] tabular-nums", tab === t.key ? t.tone : "")}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="py-6 text-center">
            <CheckCircle2 className="h-7 w-7 text-muted-foreground/30 mx-auto mb-1.5" />
            <p className="text-xs text-muted-foreground">
              {tab === "today" ? "Nothing due today 🎉" : tab === "overdue" ? "No overdue tasks" : "Nothing upcoming"}
            </p>
          </div>
        ) : (
          <div className="space-y-0.5 max-h-[360px] overflow-y-auto -mx-2 px-2">
            {filtered.slice(0, 10).map((t) => (
              <div key={t.id} className="flex items-start gap-2 py-1.5 group">
                <button
                  onClick={() => toggle(t.id, t.status)}
                  className="mt-0.5 text-muted-foreground/40 hover:text-primary transition-colors"
                >
                  <Circle className="h-3.5 w-3.5" />
                </button>
                <Link to={`/tasks/${t.id}`} className="min-w-0 flex-1 group-hover:text-foreground">
                  <p className="text-xs leading-snug truncate">{t.title}</p>
                  {t.due_date && (
                    <p className={cn(
                      "text-[10px] mt-0.5 tabular-nums",
                      tab === "overdue" ? "text-red-500" : "text-muted-foreground/70"
                    )}>
                      {format(parseISO(t.due_date), "MMM d")}
                    </p>
                  )}
                </Link>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
