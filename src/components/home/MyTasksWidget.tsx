import { useEffect, useMemo, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { CheckSquare, ArrowRight, Circle, CheckCircle2, Plus, X, Repeat } from "lucide-react";
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
  tags?: string[] | null;
}

export function MyTasksWidget() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tab, setTab] = useState<Tab>("today");
  const [drawerTask, setDrawerTask] = useState<any>(null);
  const [profileMap, setProfileMap] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.from("profiles").select("user_id, full_name").then(({ data }) => {
      if (data) {
        const m: Record<string, string> = {};
        data.forEach((p: any) => { m[p.user_id] = p.full_name || "Teammate"; });
        setProfileMap(m);
      }
    });
  }, []);

  const getName = (uid: string | null) => (uid ? profileMap[uid] || "—" : "—");

  const openTask = async (id: string) => {
    const { data } = await supabase.from("tasks").select("*").eq("id", id).maybeSingle();
    if (data) setDrawerTask(data);
  };

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("tasks")
      .select("id, title, status, due_date, priority, tags")
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

  const startCreate = () => {
    setCreating(true);
    setTab("today");
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const submitCreate = async () => {
    const title = newTitle.trim();
    if (!title || !user) { setCreating(false); setNewTitle(""); return; }
    const today = format(new Date(), "yyyy-MM-dd");
    const { data, error } = await supabase
      .from("tasks")
      .insert({ title, assigned_to: user.id, created_by: user.id, status: "todo", priority: "medium", due_date: today })
      .select("id, title, status, due_date, priority")
      .maybeSingle();
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    if (data) setTasks((prev) => [data as Task, ...prev]);
    setNewTitle("");
    setTimeout(() => inputRef.current?.focus(), 30);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); submitCreate(); }
    if (e.key === "Escape") { setCreating(false); setNewTitle(""); }
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-muted-foreground/70" /> My Tasks
          </h2>
          <div className="flex items-center gap-1">
            <button
              onClick={startCreate}
              className="h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              title="New task"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <Link to="/execution" className="text-xs text-primary hover:underline flex items-center gap-1">
              All <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
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

        {creating && tab === "today" && (
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/30 border border-border/40">
            <Circle className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
            <input
              ref={inputRef}
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={handleKey}
              onBlur={() => { if (!newTitle.trim()) setCreating(false); }}
              placeholder="New task for today…"
              className="flex-1 bg-transparent border-0 outline-none text-xs placeholder:text-muted-foreground/50"
            />
            <button onClick={() => { setCreating(false); setNewTitle(""); }} className="text-muted-foreground/40 hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="py-6 text-center">
            <CheckCircle2 className="h-7 w-7 text-muted-foreground/30 mx-auto mb-1.5" />
            <p className="text-xs text-muted-foreground">
              {tab === "today" ? "Nothing due today 🎉" : tab === "overdue" ? "No overdue tasks" : "Nothing upcoming"}
            </p>
          </div>
        ) : (
          <div className="space-y-0.5 -mx-2 px-2">
            {[...filtered]
              .sort((a, b) => {
                const aCad = (a.tags || []).some((t) => t.startsWith("cadence:"));
                const bCad = (b.tags || []).some((t) => t.startsWith("cadence:"));
                if (aCad === bCad) return 0;
                return aCad ? -1 : 1;
              })
              .slice(0, 10).map((t) => {
              const isCadence = (t.tags || []).some((tag) => tag.startsWith("cadence:"));
              const isOverdue = tab === "overdue";
              return (
                <div key={t.id} className={cn(
                  "flex items-start gap-2 py-1.5 group rounded-md -mx-1 px-1",
                  isCadence && "border-l-2 border-amber-500/60 pl-2 ml-0"
                )}>
                  <button
                    onClick={() => toggle(t.id, t.status)}
                    className="mt-0.5 text-muted-foreground/40 hover:text-primary transition-colors"
                  >
                    <Circle className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => openTask(t.id)} className="min-w-0 flex-1 text-left group-hover:text-foreground">
                    <p className="text-xs leading-snug truncate flex items-center gap-1.5">
                      {isCadence && <Repeat className="h-3 w-3 text-amber-500 shrink-0" />}
                      <span className="truncate">{t.title}</span>
                    </p>
                    {t.due_date && (
                      <p className={cn(
                        "text-[10px] mt-0.5 tabular-nums",
                        isOverdue ? "text-red-500" : "text-muted-foreground/70"
                      )}>
                        {format(parseISO(t.due_date), "MMM d")}
                      </p>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
      <DetailDrawer
        open={!!drawerTask}
        onOpenChange={(o) => { if (!o) setDrawerTask(null); }}
        type="task"
        item={drawerTask}
        onStatusChange={async (v) => {
          if (!drawerTask) return;
          await supabase.from("tasks").update({ status: v }).eq("id", drawerTask.id);
          setDrawerTask((p: any) => p ? { ...p, status: v } : null);
          setTasks((prev) => v === "done" ? prev.filter((t) => t.id !== drawerTask.id) : prev);
        }}
        onTitleChange={async (newTitle) => {
          if (!drawerTask) return;
          const { error } = await supabase.from("tasks").update({ title: newTitle }).eq("id", drawerTask.id);
          if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
          setDrawerTask((p: any) => p ? { ...p, title: newTitle } : null);
          setTasks((prev) => prev.map((t) => t.id === drawerTask.id ? { ...t, title: newTitle } : t));
        }}
        getName={getName}
      />
    </Card>
  );
}
