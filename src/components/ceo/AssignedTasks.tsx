import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

const sb = supabase as any;

type Task = {
  id: string;
  title: string;
  status: string;
  priority: string | null;
  due_date: string | null;
};

const STATUS_COLORS: Record<string, string> = {
  todo: "bg-muted text-muted-foreground",
  in_progress: "bg-blue-100 text-blue-700",
  blocked: "bg-red-100 text-red-700",
  review: "bg-yellow-100 text-yellow-700",
};

const STATUS_LABELS: Record<string, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  blocked: "Blocked",
  review: "Review",
};

export function AssignedTasks() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await sb
        .from("tasks")
        .select("id, title, status, priority, due_date")
        .eq("assigned_to", user.id)
        .neq("status", "done")
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(8);
      if (!cancelled) {
        setTasks(data ?? []);
        setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  if (loaded && tasks.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border/50 bg-card/60 p-5 elevation-1">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">From Execution Hub</h3>
        <button
          onClick={() => navigate("/tasks")}
          className="flex items-center gap-1 text-xs text-primary/70 hover:text-primary transition-colors"
        >
          View all
          <ArrowRight className="h-3 w-3" />
        </button>
      </div>

      {!loaded ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-3 rounded-full bg-muted/50 animate-pulse" style={{ width: `${80 - i * 10}%` }} />
          ))}
        </div>
      ) : (
        <div className="space-y-1.5">
          {tasks.map((task) => (
            <div key={task.id} className="flex items-center gap-2.5 py-0.5 group">
              <div className="h-1.5 w-1.5 rounded-full bg-primary/40 shrink-0" />
              <span className="flex-1 text-sm text-foreground truncate">{task.title}</span>
              <span className={cn(
                "text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0",
                STATUS_COLORS[task.status] ?? "bg-muted text-muted-foreground"
              )}>
                {STATUS_LABELS[task.status] ?? task.status}
              </span>
              {task.due_date && (
                <span className="text-[10px] text-muted-foreground/60 shrink-0 hidden sm:block">
                  {new Date(task.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
