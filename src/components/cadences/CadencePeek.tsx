import { format, addDays, startOfDay, addMonths, addQuarters } from "date-fns";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Calendar, CheckCircle2, Clock, FileText, Flame,
  User, Building2, Edit2, CheckCheck, Circle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import type { Cadence, CadenceRun } from "./CadencesTab";

interface Props {
  cadence: Cadence | null;
  runs: CadenceRun[];
  profiles: { user_id: string; full_name: string | null }[];
  departments: { id: string; name: string }[];
  docs: { id: string; title: string }[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onEdit: () => void;
  onRefresh: () => void;
}

export function cadenceScheduleLabel(c: Cadence): string {
  if (c.schedule_type === "daily") return "Daily";
  if (c.schedule_type === "weekly") {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const d = c.schedule_config?.day_of_week ?? 1;
    return `Every ${days[d]}`;
  }
  if (c.schedule_type === "monthly") return `Monthly · Day ${c.schedule_config?.day_of_month ?? 1}`;
  if (c.schedule_type === "quarterly") return "Quarterly";
  return "Custom";
}

export function cadenceNextDue(c: Cadence): Date {
  const today = startOfDay(new Date());
  if (c.schedule_type === "daily") return today;
  if (c.schedule_type === "weekly") {
    const target = c.schedule_config?.day_of_week ?? 1;
    const diff = (target - today.getDay() + 7) % 7;
    return addDays(today, diff === 0 ? 0 : diff);
  }
  if (c.schedule_type === "monthly") {
    const day = c.schedule_config?.day_of_month ?? 1;
    let next = new Date(today.getFullYear(), today.getMonth(), day);
    if (next < today) next = addMonths(next, 1);
    return next;
  }
  if (c.schedule_type === "quarterly") {
    const month = today.getMonth();
    const quarterStart = Math.floor(month / 3) * 3;
    let next = new Date(today.getFullYear(), quarterStart, 1);
    if (next <= today) next = addQuarters(next, 1);
    return next;
  }
  return today;
}

export function CadencePeek({ cadence, runs, profiles, departments, docs, open, onOpenChange, onEdit, onRefresh }: Props) {
  if (!cadence) return null;

  const getName = (uid: string | null) =>
    uid ? (profiles.find(p => p.user_id === uid)?.full_name ?? "—") : "Unassigned";
  const getDept = (did: string | null) =>
    did ? (departments.find(d => d.id === did)?.name ?? "—") : null;
  const getDoc = (did: string | null) =>
    did ? docs.find(d => d.id === did) : null;

  const cadenceRuns = runs
    .filter(r => r.cadence_id === cadence.id)
    .sort((a, b) => b.due_date.localeCompare(a.due_date));

  const streak = (() => {
    let s = 0;
    for (const r of cadenceRuns) {
      if (r.status === "completed") s++;
      else break;
    }
    return s;
  })();

  const next = cadenceNextDue(cadence);
  const today = startOfDay(new Date());
  const currentRun = cadenceRuns.find(r => r.due_date === format(today, "yyyy-MM-dd") ||
    (cadence.schedule_type === "weekly" && r.due_date >= format(addDays(today, -6), "yyyy-MM-dd")));
  const isCompletedToday = currentRun?.status === "completed";

  const markComplete = async () => {
    const todayStr = format(today, "yyyy-MM-dd");
    if (currentRun) {
      const { error } = await supabase.from("cadence_runs")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", currentRun.id);
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      else { toast({ title: "Marked complete" }); onRefresh(); }
    } else {
      const { error } = await supabase.from("cadence_runs").insert({
        cadence_id: cadence.id,
        due_date: todayStr,
        status: "completed",
        completed_at: new Date().toISOString(),
      });
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      else { toast({ title: "Marked complete" }); onRefresh(); }
    }
  };

  const doc = getDoc(cadence.sop_doc_id);
  const dept = getDept(cadence.department_id);
  const doneLooksLike = cadence.task_template?.done_looks_like as string | undefined;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-base leading-snug">{cadence.title}</SheetTitle>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge variant="outline" className="text-[11px] gap-1">
                  <Calendar className="h-3 w-3" /> {cadenceScheduleLabel(cadence)}
                </Badge>
                {streak > 0 && (
                  <Badge variant="outline" className="text-[11px] gap-1 border-orange-400/40 text-orange-500">
                    <Flame className="h-3 w-3" /> {streak} streak
                  </Badge>
                )}
                {!cadence.is_active && (
                  <Badge variant="outline" className="text-[11px] text-muted-foreground">Paused</Badge>
                )}
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={onEdit} className="shrink-0 gap-1.5">
              <Edit2 className="h-3.5 w-3.5" /> Edit
            </Button>
          </div>
        </SheetHeader>

        <div className="space-y-5">
          {/* Mark complete */}
          <Button
            className={cn("w-full gap-2", isCompletedToday && "bg-green-600 hover:bg-green-700")}
            onClick={markComplete}
            disabled={isCompletedToday}
          >
            {isCompletedToday
              ? <><CheckCheck className="h-4 w-4" /> Completed</>
              : <><CheckCircle2 className="h-4 w-4" /> Mark complete</>}
          </Button>

          <Separator />

          {/* Purpose / Description */}
          {cadence.description && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Purpose</p>
              <p className="text-sm leading-relaxed">{cadence.description}</p>
            </div>
          )}

          {/* What done looks like */}
          {doneLooksLike && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">What done looks like</p>
              <p className="text-sm leading-relaxed text-foreground/80">{doneLooksLike}</p>
            </div>
          )}

          <Separator />

          {/* Meta */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Owner</span>
              <span className="ml-auto font-medium">{getName(cadence.owner_id)}</span>
            </div>
            {dept && (
              <div className="flex items-center gap-2 text-sm">
                <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">Department</span>
                <span className="ml-auto font-medium">{dept}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Next due</span>
              <span className="ml-auto font-medium">{format(next, "MMM d, yyyy")}</span>
            </div>
          </div>

          {/* SOP / Wiki */}
          {doc && (
            <>
              <Separator />
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Wiki / SOP</p>
                <Link to={`/docs?id=${doc.id}`} onClick={() => onOpenChange(false)}>
                  <div className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/40 px-3 py-2.5 hover:bg-muted transition-colors">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium truncate">{doc.title}</span>
                  </div>
                </Link>
              </div>
            </>
          )}

          {/* Run history */}
          {cadenceRuns.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Recent runs</p>
                <div className="space-y-1.5">
                  {cadenceRuns.slice(0, 8).map(r => (
                    <div key={r.id} className="flex items-center gap-2 text-xs">
                      {r.status === "completed"
                        ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                        : <Circle className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />}
                      <span className="text-muted-foreground">{format(new Date(r.due_date), "MMM d")}</span>
                      {r.completed_at && (
                        <span className="ml-auto text-muted-foreground/60">
                          {format(new Date(r.completed_at), "h:mm a")}
                        </span>
                      )}
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] ml-auto",
                          r.status === "completed" && "border-green-500/30 text-green-600",
                          r.status === "missed" && "border-red-500/30 text-red-500",
                        )}
                      >
                        {r.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
