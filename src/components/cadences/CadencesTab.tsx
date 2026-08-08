import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDepartments } from "@/contexts/DepartmentsContext";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/UserAvatar";
import {
  Repeat, Plus, CheckCircle2, Clock,
  FileText, Flame, MoreHorizontal, Pause, Play, SkipForward, Building2,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CadenceEditor } from "./CadenceEditor";
import { CadencePeek, cadenceNextDue } from "./CadencePeek";
import { cn } from "@/lib/utils";
import { format, startOfDay } from "date-fns";
import { toast } from "@/hooks/use-toast";

export interface Cadence {
  id: string;
  title: string;
  description: string;
  owner_id: string | null;
  department_id: string | null;
  sop_doc_id: string | null;
  business_plan_id: string | null;
  schedule_type: "daily" | "weekly" | "monthly" | "quarterly" | "custom";
  schedule_config: any;
  task_template: any;
  is_active: boolean;
  created_by: string | null;
}

export interface CadenceRun {
  id: string;
  cadence_id: string;
  due_date: string;
  completed_at: string | null;
  status: string;
  note: string | null;
}

const FREQUENCY_ORDER = ["daily", "weekly", "monthly", "quarterly", "custom"] as const;
const FREQUENCY_LABELS: Record<string, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  custom: "Custom",
};

interface CadencesTabProps {
  /** When set, scopes this tab to one business plan's cadences instead of the
      company-wide list — hides the department filter (redundant once already
      scoped to a venture) and stamps new cadences with this plan. Same
      cadences/cadence_runs tables either way, so a cadence created here shows
      up in the unscoped Execution Hub view too, and vice versa. */
  businessPlanId?: string;
}

export function CadencesTab({ businessPlanId }: CadencesTabProps = {}) {
  const { user, isAdmin } = useAuth();
  const { departments } = useDepartments();
  const [cadences, setCadences] = useState<Cadence[]>([]);
  const [runs, setRuns] = useState<CadenceRun[]>([]);
  const [profiles, setProfiles] = useState<{ user_id: string; full_name: string | null; avatar_url?: string | null }[]>([]);
  const [docs, setDocs] = useState<{ id: string; title: string }[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Cadence | null>(null);
  const [peekCadence, setPeekCadence] = useState<Cadence | null>(null);
  const [peekInitialMode, setPeekInitialMode] = useState<"complete" | "skip" | null>(null);
  const [filterDept, setFilterDept] = useState<string>("all");

  const todayStr = format(startOfDay(new Date()), "yyyy-MM-dd");

  const load = async () => {
    let cadenceQuery = supabase.from("cadences").select("*").order("created_at", { ascending: true });
    if (businessPlanId) cadenceQuery = cadenceQuery.eq("business_plan_id", businessPlanId);

    const [c, r, p, d] = await Promise.all([
      cadenceQuery,
      supabase.from("cadence_runs").select("*").order("due_date", { ascending: false }).limit(500),
      supabase.from("profiles").select("user_id, full_name, avatar_url"),
      supabase.from("documents").select("id, title").eq("status", "active"),
    ]);
    if (c.data) setCadences(c.data as any);
    if (r.data) setRuns(r.data as any);
    if (p.data) setProfiles(p.data);
    if (d.data) setDocs(d.data);
  };

  useEffect(() => { load(); }, [businessPlanId]);

  const getName = (uid: string | null) =>
    uid ? (profiles.find(p => p.user_id === uid)?.full_name ?? "—") : "—";
  const getDept = (did: string | null) =>
    did ? (departments.find(d => d.id === did)?.name ?? null) : null;

  const runsByCadence = useMemo(() => {
    const m = new Map<string, CadenceRun[]>();
    runs.forEach(r => {
      if (!m.has(r.cadence_id)) m.set(r.cadence_id, []);
      m.get(r.cadence_id)!.push(r);
    });
    return m;
  }, [runs]);

  const getTodayRun = (cid: string) =>
    (runsByCadence.get(cid) ?? []).find(r => r.due_date === todayStr) ?? null;

  const streakFor = (cid: string): number => {
    const list = (runsByCadence.get(cid) ?? []).slice().sort((a, b) => b.due_date.localeCompare(a.due_date));
    let s = 0;
    for (const r of list) { if (r.status === "completed") s++; else break; }
    return s;
  };

  // Quick-complete from the card menu (no note required)
  const quickComplete = async (c: Cadence, e: React.MouseEvent) => {
    e.stopPropagation();
    const existing = getTodayRun(c.id);
    const payload: any = {
      cadence_id: c.id,
      due_date: todayStr,
      status: "completed",
      completed_at: new Date().toISOString(),
      note: null,
    };
    let error;
    if (existing) {
      ({ error } = await supabase.from("cadence_runs").update(payload).eq("id", existing.id));
    } else {
      ({ error } = await supabase.from("cadence_runs").insert(payload));
    }
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Marked complete ✓" }); load(); }
  };

  // Skip opens the peek in skip mode (reason required)
  const openSkip = (c: Cadence, e: React.MouseEvent) => {
    e.stopPropagation();
    setPeekInitialMode("skip");
    setPeekCadence(c);
  };

  const toggleActive = async (c: Cadence, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from("cadences").update({ is_active: !c.is_active }).eq("id", c.id);
    load();
  };

  // Only offered when scoped to a plan — removes the plan tag without
  // deleting the cadence; it keeps running company-wide.
  const removeFromPlan = async (c: Cadence, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from("cadences").update({ business_plan_id: null }).eq("id", c.id);
    load();
  };

  const deleteCadence = async (c: Cadence, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete "${c.title}"?`)) return;
    const { error } = await supabase.from("cadences").delete().eq("id", c.id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Cadence deleted" }); load(); }
  };

  const openEdit = (c: Cadence, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditing(c);
    setPeekCadence(null);
    setEditorOpen(true);
  };

  const openPeek = (c: Cadence) => {
    setPeekInitialMode(null);
    setPeekCadence(c);
  };

  const filtered = useMemo(() => {
    if (businessPlanId) return cadences; // already scoped by the load() query
    return filterDept === "all" ? cadences : cadences.filter(c => c.department_id === filterDept);
  }, [cadences, filterDept, businessPlanId]);

  const grouped = useMemo(() => {
    const map = new Map<string, Cadence[]>();
    for (const freq of FREQUENCY_ORDER) map.set(freq, []);
    for (const c of filtered) {
      const key = FREQUENCY_ORDER.includes(c.schedule_type as any) ? c.schedule_type : "custom";
      map.get(key)!.push(c);
    }
    return map;
  }, [filtered]);

  const totalCount = filtered.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Repeat className="h-4 w-4 text-muted-foreground" />
            Cadences
            {totalCount > 0 && <span className="text-sm font-normal text-muted-foreground">· {totalCount}</span>}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Recurring work that keeps the business running.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!businessPlanId && (
            <select
              value={filterDept}
              onChange={(e) => setFilterDept(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            >
              <option value="all">All departments</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          )}
          <Button size="sm" onClick={() => { setEditing(null); setEditorOpen(true); }}>
            <Plus className="h-3.5 w-3.5 mr-1" /> New cadence
          </Button>
        </div>
      </div>

      {/* Empty state */}
      {totalCount === 0 && (
        <div className="rounded-xl border border-dashed border-border py-14 text-center">
          <Repeat className="h-9 w-9 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium">No cadences yet</p>
          <p className="text-xs text-muted-foreground mt-1 mb-4 max-w-xs mx-auto">
            Define recurring rituals — lead imports, pipeline sweeps, coaching sessions, buyer outreach.
          </p>
          <Button size="sm" onClick={() => { setEditing(null); setEditorOpen(true); }}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Create first cadence
          </Button>
        </div>
      )}

      {/* Grouped sections */}
      {FREQUENCY_ORDER.map(freq => {
        const items = grouped.get(freq) ?? [];
        if (items.length === 0) return null;
        return (
          <div key={freq}>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2 px-1">
              {FREQUENCY_LABELS[freq]}
            </p>
            <div className="space-y-2">
              {items.map(c => {
                const streak = streakFor(c.id);
                const todayRun = getTodayRun(c.id);
                const done = todayRun?.status === "completed";
                const skipped = todayRun?.status === "skipped";
                const next = cadenceNextDue(c);
                const today = startOfDay(new Date());
                const isDue = next.getTime() === today.getTime() || next < today;
                const doc = docs.find(d => d.id === c.sop_doc_id);
                const dept = getDept(c.department_id);
                const canEdit = isAdmin || c.owner_id === user?.id || c.created_by === user?.id;

                return (
                  <div
                    key={c.id}
                    onClick={() => openPeek(c)}
                    className={cn(
                      "group relative rounded-xl border border-border bg-card cursor-pointer overflow-hidden",
                      "hover:shadow-sm hover:border-border/60 transition-all",
                      !c.is_active && "opacity-50",
                      done && "border-green-500/20 bg-green-500/[0.03]",
                    )}
                  >
                    {/* Left accent bar */}
                    <div className={cn(
                      "absolute left-0 top-0 bottom-0 w-[3px]",
                      done ? "bg-green-500" : skipped ? "bg-muted-foreground/30" : isDue ? "bg-amber-400" : "bg-muted-foreground/15"
                    )} />

                    <div className="pl-[18px] pr-3 py-3.5">
                      {/* Row 1: Title + status + menu */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={cn(
                            "text-sm font-semibold leading-snug",
                            done && "text-muted-foreground line-through",
                            skipped && "text-muted-foreground",
                          )}>
                            {c.title}
                          </span>
                          {done && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-600 bg-green-500/10 border border-green-500/20 rounded-full px-1.5 py-0.5 shrink-0">
                              <CheckCircle2 className="h-2.5 w-2.5" /> Done
                            </span>
                          )}
                          {skipped && !done && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground bg-muted border border-border rounded-full px-1.5 py-0.5 shrink-0">
                              <SkipForward className="h-2.5 w-2.5" /> Skipped
                            </span>
                          )}
                        </div>

                        {/* 3-dot menu — always visible */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0 -mt-0.5 -mr-0.5">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            {!done && (
                              <DropdownMenuItem onClick={(e) => quickComplete(c, e)}>
                                <CheckCircle2 className="h-3.5 w-3.5 mr-2 text-green-600" /> Mark complete
                              </DropdownMenuItem>
                            )}
                            {!done && !skipped && (
                              <DropdownMenuItem onClick={(e) => openSkip(c, e)}>
                                <SkipForward className="h-3.5 w-3.5 mr-2 text-amber-500" /> Skip this cycle
                              </DropdownMenuItem>
                            )}
                            {(done || skipped) && (
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openPeek(c); }}>
                                View details
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            {canEdit && (
                              <DropdownMenuItem onClick={(e) => openEdit(c, e)}>Edit</DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={(e) => toggleActive(c, e)}>
                              {c.is_active
                                ? <><Pause className="h-3.5 w-3.5 mr-2" /> Pause</>
                                : <><Play className="h-3.5 w-3.5 mr-2" /> Resume</>}
                            </DropdownMenuItem>
                            {businessPlanId && (
                              <DropdownMenuItem onClick={(e) => removeFromPlan(c, e)}>
                                Remove from this plan
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={(e) => deleteCadence(c, e)}
                              className="text-red-500 focus:text-red-500"
                            >
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {/* Row 2: Purpose */}
                      {c.description && (
                        <p className="text-[12px] text-muted-foreground mt-1.5 leading-relaxed line-clamp-2 pr-1">
                          {c.description}
                        </p>
                      )}

                      {/* Row 3: Meta chips */}
                      <div className="flex items-center gap-3 mt-2.5 flex-wrap">
                        {/* Owner */}
                        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <UserAvatar
                            name={getName(c.owner_id)}
                            avatarUrl={profiles.find(p => p.user_id === c.owner_id)?.avatar_url}
                            className="h-3.5 w-3.5"
                            fallbackClassName="text-[7px]"
                          />
                          {getName(c.owner_id)}
                        </span>
                        {/* Department */}
                        {dept && (
                          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Building2 className="h-3 w-3" /> {dept}
                          </span>
                        )}
                        {/* Next due */}
                        <span className={cn(
                          "flex items-center gap-1 text-[11px]",
                          isDue && !done && !skipped ? "text-amber-600 font-medium" : "text-muted-foreground"
                        )}>
                          <Clock className="h-3 w-3" />
                          {done || skipped ? format(next, "MMM d") : isDue ? "Due today" : format(next, "MMM d")}
                        </span>
                        {/* Wiki / SOP */}
                        {doc && (
                          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <FileText className="h-3 w-3" />
                            {doc.title.length > 24 ? doc.title.slice(0, 24) + "…" : doc.title}
                          </span>
                        )}
                        {/* Streak */}
                        {streak > 1 && (
                          <span className="flex items-center gap-1 text-[11px] text-orange-500 ml-auto">
                            <Flame className="h-3 w-3" /> {streak}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Peek */}
      <CadencePeek
        cadence={peekCadence}
        runs={runs}
        profiles={profiles}
        departments={departments}
        docs={docs}
        open={!!peekCadence}
        initialLogMode={peekInitialMode}
        onOpenChange={(o) => { if (!o) { setPeekCadence(null); setPeekInitialMode(null); } }}
        onEdit={() => { setEditing(peekCadence); setPeekCadence(null); setEditorOpen(true); }}
        onRefresh={load}
      />

      {/* Editor */}
      <CadenceEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        cadence={editing}
        businessPlanId={businessPlanId}
        onSaved={() => { setEditorOpen(false); load(); }}
      />
    </div>
  );
}
