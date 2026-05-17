import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Sparkles, Loader2, Check, X, AlertTriangle, FolderKanban, CheckSquare, RefreshCw, Send } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const sb = supabase as any;

type PlanPriority = { title: string; why: string };
type PlanProject = { title: string; description: string; department_id: string | null; rationale: string };
type PlanTask = { title: string; description: string; assignee_user_id: string | null; project_id: string | null; priority: "low" | "medium" | "high"; rationale: string };
type PlanRisk = { issue: string; mitigation: string };
type Plan = {
  headline: string;
  priorities: PlanPriority[];
  new_projects: PlanProject[];
  new_tasks: PlanTask[];
  risks: PlanRisk[];
};

type ItemKey = string;

export function AlbusPlanWeekButton() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [week, setWeek] = useState<string>("");
  const [accepted, setAccepted] = useState<Set<ItemKey>>(new Set());
  const [dismissed, setDismissed] = useState<Set<ItemKey>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    setAccepted(new Set());
    setDismissed(new Set());
    const { data, error } = await supabase.functions.invoke("albus-plan-week");
    setLoading(false);
    if (error) { setError(error.message || "Couldn't generate plan"); return; }
    if (data?.error) { setError(data.error); return; }
    setPlan(data.plan);
    setWeek(data.week);
  };

  const onOpen = () => {
    setOpen(true);
    if (!plan && !loading) void generate();
  };

  const acceptProject = async (key: ItemKey, p: PlanProject) => {
    if (!user || accepted.has(key)) return;
    const { error } = await sb.from("projects").insert({
      title: p.title,
      description: p.description,
      department_id: p.department_id || null,
      owner_id: user.id,
      created_by: user.id,
      priority: "medium",
    });
    if (error) { toast.error(error.message); return; }
    setAccepted((s) => new Set(s).add(key));
    toast.success("Project added");
  };

  const acceptTask = async (key: ItemKey, t: PlanTask) => {
    if (!user || accepted.has(key)) return;
    const { error } = await sb.from("tasks").insert({
      title: t.title,
      description: t.description,
      status: "todo",
      priority: t.priority || "medium",
      assigned_to: t.assignee_user_id || user.id,
      created_by: user.id,
      project_id: t.project_id || null,
    });
    if (error) { toast.error(error.message); return; }
    setAccepted((s) => new Set(s).add(key));
    toast.success("Task added");
  };

  const acceptAll = async () => {
    if (!plan) return;
    for (let i = 0; i < plan.new_projects.length; i++) {
      const k = `project:${i}`;
      if (!accepted.has(k) && !dismissed.has(k)) await acceptProject(k, plan.new_projects[i]);
    }
    for (let i = 0; i < plan.new_tasks.length; i++) {
      const k = `task:${i}`;
      if (!accepted.has(k) && !dismissed.has(k)) await acceptTask(k, plan.new_tasks[i]);
    }
  };

  const dismiss = (key: ItemKey) => setDismissed((s) => new Set(s).add(key));
  const isResolved = (key: ItemKey) => accepted.has(key) || dismissed.has(key);

  return (
    <>
      <button
        onClick={onOpen}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/15 border border-primary/20 transition-colors"
      >
        <Sparkles className="h-3.5 w-3.5" /> Albus: Plan the Week
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader className="space-y-1">
            <SheetTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Albus · Week Plan
              {week && <span className="text-xs text-muted-foreground font-normal ml-2">{week}</span>}
            </SheetTitle>
            {plan && (
              <p className="text-sm text-muted-foreground pt-1">{plan.headline}</p>
            )}
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {loading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-12 justify-center">
                <Loader2 className="h-4 w-4 animate-spin" /> Pulling your context and drafting a plan…
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm space-y-2">
                <p className="font-medium text-destructive">Couldn't generate</p>
                <p className="text-muted-foreground text-xs">{error}</p>
                <button onClick={generate} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                  <RefreshCw className="h-3 w-3" /> Try again
                </button>
              </div>
            )}

            {plan && !loading && (
              <>
                {plan.priorities.length > 0 && (
                  <Section title="Priorities" icon={<Sparkles className="h-3.5 w-3.5 text-primary" />}>
                    {plan.priorities.map((p, i) => (
                      <div key={i} className="rounded-lg border border-border/40 bg-card/40 p-3">
                        <p className="text-sm font-medium text-foreground">{p.title}</p>
                        <p className="text-xs text-muted-foreground mt-1">{p.why}</p>
                      </div>
                    ))}
                  </Section>
                )}

                {plan.new_projects.length > 0 && (
                  <Section title="New projects to spin up" icon={<FolderKanban className="h-3.5 w-3.5 text-sky-600" />}>
                    {plan.new_projects.map((p, i) => {
                      const key = `project:${i}`;
                      return (
                        <SuggestionCard
                          key={key}
                          resolved={isResolved(key)}
                          accepted={accepted.has(key)}
                          dismissed={dismissed.has(key)}
                          title={p.title}
                          description={p.description}
                          rationale={p.rationale}
                          onAccept={() => acceptProject(key, p)}
                          onDismiss={() => dismiss(key)}
                          acceptLabel="Add project"
                        />
                      );
                    })}
                  </Section>
                )}

                {plan.new_tasks.length > 0 && (
                  <Section title="Tasks to dispatch" icon={<CheckSquare className="h-3.5 w-3.5 text-amber-600" />}>
                    {plan.new_tasks.map((t, i) => {
                      const key = `task:${i}`;
                      return (
                        <SuggestionCard
                          key={key}
                          resolved={isResolved(key)}
                          accepted={accepted.has(key)}
                          dismissed={dismissed.has(key)}
                          title={t.title}
                          description={t.description}
                          rationale={t.rationale}
                          priority={t.priority}
                          onAccept={() => acceptTask(key, t)}
                          onDismiss={() => dismiss(key)}
                          acceptLabel="Add task"
                        />
                      );
                    })}
                  </Section>
                )}

                {plan.risks.length > 0 && (
                  <Section title="Risks I'm tracking" icon={<AlertTriangle className="h-3.5 w-3.5 text-amber-600" />}>
                    {plan.risks.map((r, i) => (
                      <div key={i} className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 space-y-1">
                        <p className="text-sm font-medium text-foreground">{r.issue}</p>
                        <p className="text-xs text-muted-foreground"><span className="font-semibold uppercase tracking-wide text-[10px]">Mitigation:</span> {r.mitigation}</p>
                      </div>
                    ))}
                  </Section>
                )}

                <div className="flex items-center justify-between gap-2 pt-4 border-t border-border/40 sticky bottom-0 bg-background py-3 -mx-6 px-6">
                  <button
                    onClick={generate}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <RefreshCw className="h-3 w-3" /> Regenerate
                  </button>
                  <button
                    onClick={acceptAll}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground"
                  >
                    <Send className="h-3 w-3" /> Accept all remaining
                  </button>
                </div>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 px-1">
        {icon}
        <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/80">{title}</h3>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function SuggestionCard({
  title, description, rationale, priority, onAccept, onDismiss, resolved, accepted, dismissed, acceptLabel,
}: {
  title: string; description: string; rationale: string;
  priority?: "low" | "medium" | "high";
  onAccept: () => void; onDismiss: () => void;
  resolved: boolean; accepted: boolean; dismissed: boolean;
  acceptLabel: string;
}) {
  return (
    <div className={cn(
      "rounded-lg border bg-card/40 p-3 space-y-2 transition-opacity",
      resolved && "opacity-60",
      dismissed ? "border-border/30" : "border-border/40",
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-foreground">{title}</p>
            {priority === "high" && <span className="text-[10px] font-medium text-red-600 bg-red-500/10 px-1.5 py-0.5 rounded">High</span>}
            {accepted && <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-600"><Check className="h-3 w-3" /> Added</span>}
            {dismissed && <span className="text-[10px] text-muted-foreground/60">Dismissed</span>}
          </div>
          {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
          {rationale && (
            <p className="text-[11px] text-muted-foreground/70 mt-1.5 italic">{rationale}</p>
          )}
        </div>
      </div>
      {!resolved && (
        <div className="flex items-center gap-1.5 pt-1">
          <button onClick={onAccept} className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20">
            <Check className="h-3 w-3" /> {acceptLabel}
          </button>
          <button onClick={onDismiss} className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted">
            <X className="h-3 w-3" /> Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
