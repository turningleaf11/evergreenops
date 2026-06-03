import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTraining } from "@/contexts/TrainingContext";
import { useTrainingProgress } from "@/lib/training-progress";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

const sb = supabase as any;

export function OnboardingTab({ employeeId }: { employeeId: string }) {
  const { onboardingSteps, loading } = useTraining();
  const { completedOnboardingSteps } = useTrainingProgress();
  const { user } = useAuth();
  const [employeeIsPrimaryAdmin, setEmployeeIsPrimaryAdmin] = useState<boolean | null>(null);

  // Onboarding progress is currently stored in localStorage per-viewer.
  // We can only show real completion status when the viewer IS the employee.
  const isSelf = user?.id === employeeId;

  // Resolve whether the EMPLOYEE is the PRIMARY admin (the workspace creator).
  // Workspace-setup steps (audience='admin') are ONLY for them — not for
  // later-flipped admins, who join an already-configured workspace.
  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await sb
        .from("user_roles")
        .select("role, is_primary")
        .eq("user_id", employeeId);
      if (!active) return;
      const rows = (data ?? []) as Array<{ role: string; is_primary: boolean }>;
      setEmployeeIsPrimaryAdmin(rows.some((r) => r.role === "admin" && r.is_primary === true));
    })();
    return () => { active = false; };
  }, [employeeId]);

  // Filter steps. Primary admins (workspace creators) see admin + everyone.
  // Everyone else — including later-promoted admins — only sees user + everyone.
  const visibleSteps = useMemo(() => {
    if (employeeIsPrimaryAdmin === null) return [];
    return onboardingSteps.filter((s) => {
      if (s.audience === "everyone") return true;
      if (s.audience === "admin")    return employeeIsPrimaryAdmin;
      if (s.audience === "user")     return !employeeIsPrimaryAdmin;
      return true;
    });
  }, [onboardingSteps, employeeIsPrimaryAdmin]);

  if (loading || employeeIsPrimaryAdmin === null) {
    return <p className="text-xs text-muted-foreground">Loading…</p>;
  }

  if (visibleSteps.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground space-y-2">
        <p>No onboarding assigned. Go to Training to assign.</p>
        <Link to="/training" className="text-primary hover:underline text-xs">Open Training →</Link>
      </div>
    );
  }

  const completedSet = new Set(isSelf ? completedOnboardingSteps : []);
  const completedCount = visibleSteps.filter((s) => completedSet.has(s.id)).length;
  const pct = Math.round((completedCount / visibleSteps.length) * 100);

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm font-medium">Onboarding progress</span>
          <span className="text-sm text-muted-foreground">{pct}% · {completedCount}/{visibleSteps.length}</span>
        </div>
        <Progress value={pct} className="h-2" />
        {!isSelf && (
          <p className="text-[11px] text-muted-foreground italic mt-2">
            Showing assigned checklist. Personal completion is tracked in this employee's own session.
          </p>
        )}
      </div>

      <div className="space-y-2">
        {visibleSteps.map((step, idx) => {
          const done = completedSet.has(step.id);
          return (
            <div
              key={step.id}
              className={cn(
                "flex items-start gap-3 rounded-lg border p-3 bg-card",
                done && "bg-emerald-500/5 border-emerald-500/30",
              )}
            >
              <div className={cn(
                "h-5 w-5 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                done ? "bg-emerald-500 text-white" : "border-2 border-muted-foreground/30",
              )}>
                {done ? <Check className="h-3 w-3" /> : <Circle className="h-3 w-3 opacity-0" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{idx + 1}. {step.title}</p>
                {step.description && <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>}
                {step.link && (
                  <a href={step.link} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline mt-1 inline-block">
                    {step.linkLabel || "Open link"} →
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="pt-2 border-t">
        <Link to="/training" className="text-xs text-primary hover:underline">Manage onboarding in Training →</Link>
      </div>
    </div>
  );
}
