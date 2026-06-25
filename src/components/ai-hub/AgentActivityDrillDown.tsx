import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChevronRight, ChevronDown, Loader2, FileText, AlertTriangle, MessageSquare, Wrench, CheckCircle2 } from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";
import type { AiLog, AiLogCategory } from "@/types/aiLogs";
import { cn } from "@/lib/utils";

const sb = supabase as any;

type AgentTask = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  assigned_to: string | null;
  context: Record<string, unknown> | null;
  result: string | null;
  error: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  type: string | null;
};

const CATEGORY_TONE: Record<AiLogCategory | "default", { label: string; cls: string; icon: React.ElementType }> = {
  task_created:   { label: "Created",   cls: "bg-purple-500/10 text-purple-700 dark:text-purple-300", icon: FileText },
  task_status:    { label: "Status",    cls: "bg-amber-500/10 text-amber-700 dark:text-amber-300", icon: AlertTriangle },
  task_updated:   { label: "Updated",   cls: "bg-slate-500/10 text-slate-700 dark:text-slate-300", icon: FileText },
  task_started:   { label: "Started",   cls: "bg-blue-500/10 text-blue-700 dark:text-blue-300", icon: AlertTriangle },
  task_completed: { label: "Completed", cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", icon: CheckCircle2 },
  task_failed:    { label: "Failed",    cls: "bg-red-500/10 text-red-700 dark:text-red-300", icon: AlertTriangle },
  agent_message:  { label: "Message",   cls: "bg-slate-500/10 text-slate-700 dark:text-slate-300", icon: MessageSquare },
  agent_thought:  { label: "Thinking",  cls: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300", icon: MessageSquare },
  agent_tool:     { label: "Tool",      cls: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300", icon: Wrench },
  default:        { label: "Event",     cls: "bg-muted text-muted-foreground", icon: FileText },
};

const STATUS_TONE: Record<string, string> = {
  done: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  completed: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  doing: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  in_progress: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  pending: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  backlog: "bg-muted text-muted-foreground",
  needs_input: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  cancelled: "bg-red-500/10 text-red-700 dark:text-red-300",
  failed: "bg-red-500/10 text-red-700 dark:text-red-300",
};

function relTime(iso: string) {
  try { return formatDistanceToNow(parseISO(iso), { addSuffix: true }); } catch { return ""; }
}

export function AgentActivityDrillDown({ taskId }: { taskId?: string } = {}) {
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [logs, setLogs] = useState<AiLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(taskId ? [taskId] : []));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      let taskQuery = sb.from("agent_tasks").select("*").order("updated_at", { ascending: false });
      let logQuery = sb.from("ai_logs").select("*").order("created_at", { ascending: false });
      if (taskId) {
        taskQuery = taskQuery.eq("id", taskId);
        logQuery = logQuery.eq("task_id", taskId);
      } else {
        taskQuery = taskQuery.limit(50);
        logQuery = logQuery.limit(500);
      }
      const [{ data: tRows }, { data: lRows }] = await Promise.all([taskQuery, logQuery]);
      if (cancelled) return;
      setTasks((tRows ?? []) as AgentTask[]);
      setLogs((lRows ?? []) as AiLog[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [taskId]);

  const logsByTask = useMemo(() => {
    const m = new Map<string, AiLog[]>();
    for (const l of logs) {
      if (!l.task_id) continue;
      const arr = m.get(l.task_id) ?? [];
      arr.push(l);
      m.set(l.task_id, arr);
    }
    // Most recent first per task
    for (const arr of m.values()) arr.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    return m;
  }, [logs]);

  const toggle = (id: string) =>
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (loading) {
    return <div className="flex items-center justify-center py-12 gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;
  }

  if (tasks.length === 0) {
    return <p className="text-center text-sm text-muted-foreground py-12">No agent tasks yet. Run an agent to see history here.</p>;
  }

  return (
    <div className="divide-y divide-border/40">
      {tasks.map((t) => {
        const taskLogs = logsByTask.get(t.id) ?? [];
        const latest = taskLogs[0];
        const isOpen = expanded.has(t.id);
        const statusCls = STATUS_TONE[t.status] ?? "bg-muted text-muted-foreground";
        return (
          <div key={t.id} className="py-2">
            <button
              onClick={() => toggle(t.id)}
              className="w-full text-left flex items-start gap-2.5 px-3 py-2 rounded-lg hover:bg-muted/40 transition-colors"
            >
              {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground mt-1 shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground mt-1 shrink-0" />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-foreground truncate">{t.title}</span>
                  <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full uppercase tracking-wider", statusCls)}>
                    {(t.status || "").replace(/_/g, " ")}
                  </span>
                  {t.assigned_to && (
                    <span className="text-[10px] text-muted-foreground">· {t.assigned_to}</span>
                  )}
                  <span className="text-[10px] text-muted-foreground ml-auto shrink-0">{taskLogs.length} event{taskLogs.length === 1 ? "" : "s"}</span>
                </div>
                {latest && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    Latest: {CATEGORY_TONE[latest.category]?.label ?? "Event"} · {relTime(latest.created_at)}
                  </p>
                )}
              </div>
            </button>

            {isOpen && (
              <div className="ml-9 mt-2 mb-3 space-y-3">
                {/* Task body / description */}
                {(t.description || t.result || t.error || t.notes) && (
                  <div className="rounded-lg border border-border/40 bg-card/40 p-3 space-y-2 text-xs">
                    {t.description && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">Brief</p>
                        <p className="text-foreground whitespace-pre-wrap">{t.description}</p>
                      </div>
                    )}
                    {t.result && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-700 dark:text-emerald-400 mb-0.5">Result</p>
                        <p className="text-foreground whitespace-pre-wrap">{t.result}</p>
                      </div>
                    )}
                    {t.error && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-red-700 dark:text-red-400 mb-0.5">Error</p>
                        <p className="text-foreground whitespace-pre-wrap">{t.error}</p>
                      </div>
                    )}
                    {t.notes && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">Notes</p>
                        <p className="text-foreground whitespace-pre-wrap">{t.notes}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Timeline */}
                {taskLogs.length > 0 ? (
                  <div className="relative pl-4 border-l border-border/40 space-y-2">
                    {taskLogs.slice().reverse().map((l) => {
                      const tone = CATEGORY_TONE[l.category] ?? CATEGORY_TONE.default;
                      const Icon = tone.icon;
                      return (
                        <div key={l.id} className="relative">
                          <span className="absolute -left-[1.05rem] top-1 h-1.5 w-1.5 rounded-full bg-primary/60" />
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <span className={cn("inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full", tone.cls)}>
                              <Icon className="h-2.5 w-2.5" />
                              {tone.label}
                            </span>
                            <span className="text-[10px] text-muted-foreground">{relTime(l.created_at)}</span>
                          </div>
                          <p className="text-xs text-foreground/90 mt-0.5 whitespace-pre-wrap break-words">{l.message}</p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground/60 italic px-2">No activity events yet for this task.</p>
                )}

                {/* Created/updated stamps */}
                <p className="text-[10px] text-muted-foreground/60 px-1">
                  Created {relTime(t.created_at)} · Updated {relTime(t.updated_at)}
                  {t.completed_at && ` · Completed ${relTime(t.completed_at)}`}
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
