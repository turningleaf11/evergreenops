import { useState, useEffect } from "react";
import { format, addDays, startOfDay, addMonths, addQuarters } from "date-fns";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Calendar, CheckCircle2, Clock, FileText, Flame,
  User, Building2, Edit2, CheckCheck, Circle, ExternalLink,
  SkipForward, X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import DocPeek from "@/components/mention-peek/peeks/DocPeek";
import type { Cadence, CadenceRun } from "./CadencesTab";

interface Props {
  cadence: Cadence | null;
  runs: CadenceRun[];
  profiles: { user_id: string; full_name: string | null }[];
  departments: { id: string; name: string }[];
  docs: { id: string; title: string }[];
  open: boolean;
  initialLogMode?: "complete" | "skip" | null;
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

export function CadencePeek({ cadence, runs, profiles, departments, docs, open, initialLogMode, onOpenChange, onEdit, onRefresh }: Props) {
  const [docPeekId, setDocPeekId] = useState<string | null>(null);
  const [logMode, setLogMode] = useState<"complete" | "skip" | null>(null);
  const [logNote, setLogNote] = useState("");

  // When the peek opens with a pre-selected mode (e.g. Skip from card menu), apply it
  useEffect(() => {
    if (open && initialLogMode) {
      setLogMode(initialLogMode);
      setLogNote("");
    }
    if (!open) {
      setLogMode(null);
      setLogNote("");
    }
  }, [open, initialLogMode]);

  if (!cadence) return null;

  const getName = (uid: string | null) =>
    uid ? (profiles.find(p => p.user_id === uid)?.full_name ?? "—") : "Unassigned";
  const getDept = (did: string | null) =>
    did ? (departments.find(d => d.id === did)?.name ?? null) : null;
  const getDoc = (did: string | null) =>
    did ? docs.find(d => d.id === did) : null;

  const cadenceRuns = runs
    .filter(r => r.cadence_id === cadence.id)
    .sort((a, b) => b.due_date.localeCompare(a.due_date));

  const streak = (() => {
    let s = 0;
    for (const r of cadenceRuns) {
      if (r.status === "completed") s++; else break;
    }
    return s;
  })();

  const next = cadenceNextDue(cadence);
  const today = startOfDay(new Date());
  const todayStr = format(today, "yyyy-MM-dd");
  const currentRun = cadenceRuns.find(r => r.due_date === todayStr);
  const isCompletedToday = currentRun?.status === "completed";

  const submitLog = async () => {
    const status = logMode === "complete" ? "completed" : "skipped";
    const payload: any = {
      cadence_id: cadence.id,
      due_date: todayStr,
      status,
      note: logNote.trim() || null,
      ...(status === "completed" ? { completed_at: new Date().toISOString() } : {}),
    };

    let error;
    if (currentRun) {
      ({ error } = await supabase.from("cadence_runs").update(payload).eq("id", currentRun.id));
    } else {
      ({ error } = await supabase.from("cadence_runs").insert(payload));
    }

    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: status === "completed" ? "Marked complete ✓" : "Logged as skipped" });
    setLogMode(null);
    setLogNote("");
    onRefresh();
  };

  const cancelLog = () => { setLogMode(null); setLogNote(""); };

  const doc = getDoc(cadence.sop_doc_id);
  const dept = getDept(cadence.department_id);
  const doneLooksLike = cadence.task_template?.done_looks_like as string | undefined;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto flex flex-col gap-0 p-0">
          {/* Header — sits below the built-in X */}
          <div className="px-6 pt-10 pb-4 border-b border-border/50">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-semibold leading-snug">{cadence.title}</h2>
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
              <Button size="sm" variant="outline" onClick={onEdit} className="shrink-0 gap-1.5 mt-0.5">
                <Edit2 className="h-3.5 w-3.5" /> Edit
              </Button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {/* Actions */}
            {isCompletedToday ? (
              <div className="flex items-center justify-center gap-2 rounded-lg bg-green-500/10 border border-green-500/20 py-2.5 text-sm text-green-600 font-medium">
                <CheckCheck className="h-4 w-4" /> Completed today
              </div>
            ) : currentRun?.status === "skipped" ? (
              <div className="flex items-center justify-center gap-2 rounded-lg bg-muted border border-border py-2.5 text-sm text-muted-foreground font-medium">
                <SkipForward className="h-4 w-4" /> Skipped this cycle
              </div>
            ) : logMode ? (
              <div className="space-y-2.5 rounded-xl border border-border bg-muted/30 p-3">
                <p className="text-xs font-medium text-muted-foreground">
                  {logMode === "complete" ? "Add a completion note (optional)" : "Reason for skipping (required)"}
                </p>
                <Textarea
                  autoFocus
                  value={logNote}
                  onChange={e => setLogNote(e.target.value)}
                  placeholder={logMode === "complete"
                    ? "e.g. loaded 2,891 leads into GHL"
                    : "e.g. holiday week, pushing to next Monday"}
                  rows={2}
                  className="text-sm resize-none"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className={cn("flex-1 gap-1.5", logMode === "complete" ? "" : "bg-amber-500 hover:bg-amber-600")}
                    onClick={submitLog}
                    disabled={logMode === "skip" && !logNote.trim()}
                  >
                    {logMode === "complete"
                      ? <><CheckCircle2 className="h-3.5 w-3.5" /> Confirm complete</>
                      : <><SkipForward className="h-3.5 w-3.5" /> Confirm skip</>}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={cancelLog} className="px-2.5">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button className="flex-1 gap-1.5" onClick={() => setLogMode("complete")}>
                  <CheckCircle2 className="h-4 w-4" /> Mark complete
                </Button>
                <Button variant="outline" className="gap-1.5 text-muted-foreground" onClick={() => setLogMode("skip")}>
                  <SkipForward className="h-4 w-4" /> Skip
                </Button>
              </div>
            )}

            <Separator />

            {/* Purpose */}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Purpose</p>
              {cadence.description
                ? <p className="text-sm leading-relaxed">{cadence.description}</p>
                : <p className="text-sm text-muted-foreground/50 italic">Not set</p>}
            </div>

            {/* What done looks like — always visible */}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">What done looks like</p>
              {doneLooksLike
                ? <p className="text-sm leading-relaxed text-foreground/80">{doneLooksLike}</p>
                : <p className="text-sm text-muted-foreground/50 italic">Not set — edit to add a completion definition</p>}
            </div>

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

            {/* Wiki / SOP */}
            {doc && (
              <>
                <Separator />
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Wiki / SOP</p>
                  <button
                    onClick={() => setDocPeekId(doc.id)}
                    className="w-full flex items-center gap-2.5 rounded-lg border border-border bg-muted/40 px-3 py-2.5 hover:bg-muted transition-colors text-left"
                  >
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium truncate flex-1">{doc.title}</span>
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                  </button>
                </div>
              </>
            )}

            {/* Run history */}
            {cadenceRuns.length > 0 && (
              <>
                <Separator />
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Recent runs</p>
                  <div className="space-y-1.5">
                    {cadenceRuns.slice(0, 8).map(r => (
                      <div key={r.id} className="space-y-0.5">
                        <div className="flex items-center gap-2 text-xs">
                          {r.status === "completed"
                            ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                            : r.status === "skipped"
                              ? <SkipForward className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                              : <Circle className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0" />}
                          <span className="text-muted-foreground">{format(new Date(r.due_date), "MMM d")}</span>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] ml-auto",
                              r.status === "completed" && "border-green-500/30 text-green-600",
                              r.status === "skipped" && "border-amber-400/30 text-amber-500",
                              r.status === "missed" && "border-red-500/30 text-red-500",
                            )}
                          >
                            {r.status}
                          </Badge>
                        </div>
                        {r.note && (
                          <p className="text-[11px] text-muted-foreground/70 pl-5 italic">{r.note}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Doc peek — opens on top of cadence peek */}
      {docPeekId && (
        <DocPeek
          id={docPeekId}
          open={!!docPeekId}
          onClose={() => setDocPeekId(null)}
          variant="doc"
        />
      )}
    </>
  );
}
