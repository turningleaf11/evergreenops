import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDepartments } from "@/contexts/DepartmentsContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Repeat, Plus, Calendar, CheckCircle2, AlertTriangle, Clock, FileText, Play } from "lucide-react";
import { supabase as sb } from "@/integrations/supabase/client";
import { CadenceEditor } from "./CadenceEditor";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { format, addDays, startOfDay } from "date-fns";
import { toast } from "@/hooks/use-toast";

export interface Cadence {
  id: string;
  title: string;
  description: string;
  owner_id: string | null;
  department_id: string | null;
  sop_doc_id: string | null;
  schedule_type: "daily" | "weekly" | "monthly" | "custom";
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
}

const cadenceLabel = (c: Cadence): string => {
  if (c.schedule_type === "daily") return "Daily";
  if (c.schedule_type === "weekly") {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const d = c.schedule_config?.day_of_week ?? 1;
    return `Every ${days[d]}`;
  }
  if (c.schedule_type === "monthly") {
    return `Day ${c.schedule_config?.day_of_month ?? 1} monthly`;
  }
  return "Custom";
};

const computeNextDue = (c: Cadence): Date => {
  const today = startOfDay(new Date());
  if (c.schedule_type === "daily") return today;
  if (c.schedule_type === "weekly") {
    const target = c.schedule_config?.day_of_week ?? 1;
    const diff = (target - today.getDay() + 7) % 7;
    return addDays(today, diff);
  }
  if (c.schedule_type === "monthly") {
    const day = c.schedule_config?.day_of_month ?? 1;
    const next = new Date(today.getFullYear(), today.getMonth(), day);
    if (next < today) next.setMonth(next.getMonth() + 1);
    return next;
  }
  return today;
};

export function CadencesTab() {
  const { user, isAdmin } = useAuth();
  const { departments } = useDepartments();
  const [cadences, setCadences] = useState<Cadence[]>([]);
  const [runs, setRuns] = useState<CadenceRun[]>([]);
  const [profiles, setProfiles] = useState<{ user_id: string; full_name: string | null }[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Cadence | null>(null);
  const [filterDept, setFilterDept] = useState<string>("all");

  const load = async () => {
    const [c, r, p] = await Promise.all([
      supabase.from("cadences").select("*").order("created_at", { ascending: false }),
      supabase.from("cadence_runs").select("*").order("due_date", { ascending: false }).limit(500),
      supabase.from("profiles").select("user_id, full_name"),
    ]);
    if (c.data) setCadences(c.data as any);
    if (r.data) setRuns(r.data as any);
    if (p.data) setProfiles(p.data);
  };

  useEffect(() => { load(); }, []);

  const getName = (uid: string | null) => uid ? (profiles.find(p => p.user_id === uid)?.full_name || "—") : "Unassigned";

  const runsByCadence = useMemo(() => {
    const m = new Map<string, CadenceRun[]>();
    runs.forEach(r => {
      if (!m.has(r.cadence_id)) m.set(r.cadence_id, []);
      m.get(r.cadence_id)!.push(r);
    });
    return m;
  }, [runs]);

  const streakFor = (cid: string): number => {
    const list = (runsByCadence.get(cid) || []).slice().sort((a, b) => b.due_date.localeCompare(a.due_date));
    let streak = 0;
    for (const r of list) {
      if (r.status === "completed") streak++;
      else break;
    }
    return streak;
  };

  const statusFor = (c: Cadence): "on_track" | "upcoming" | "missed" => {
    const next = computeNextDue(c);
    const today = startOfDay(new Date());
    if (next < today) return "missed";
    if (next.getTime() === today.getTime()) return "upcoming";
    return "on_track";
  };

  const filtered = useMemo(() => {
    if (filterDept === "all") return cadences;
    return cadences.filter(c => c.department_id === filterDept);
  }, [cadences, filterDept]);

  const toggleActive = async (c: Cadence) => {
    await supabase.from("cadences").update({ is_active: !c.is_active }).eq("id", c.id);
    load();
  };

  const deleteCadence = async (c: Cadence) => {
    if (!confirm(`Delete cadence "${c.title}"?`)) return;
    const { error } = await supabase.from("cadences").delete().eq("id", c.id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Cadence deleted" }); load(); }
  };

  const statusDot: Record<string, string> = {
    on_track: "bg-green-500",
    upcoming: "bg-amber-500",
    missed: "bg-red-500",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Repeat className="h-4 w-4 text-muted-foreground" />
            Cadences
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Recurring work that keeps the business running. Auto-generates tasks on schedule.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          >
            <option value="all">All departments</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              const { data, error } = await sb.functions.invoke("cadences-generate");
              if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
              else { toast({ title: "Generated", description: `${(data as any)?.generated ?? 0} new tasks` }); load(); }
            }}
          >
            <Play className="h-3.5 w-3.5 mr-1" /> Run now
          </Button>
          <Button size="sm" onClick={() => { setEditing(null); setEditorOpen(true); }}>
            <Plus className="h-3.5 w-3.5 mr-1" /> New cadence
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Repeat className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-medium">No cadences yet</p>
            <p className="text-xs text-muted-foreground mt-1 mb-4 max-w-sm mx-auto">
              Define recurring rituals like weekly reporting, lead imports, or QA call calibrations. They'll auto-generate as tasks for the owner.
            </p>
            <Button size="sm" onClick={() => { setEditing(null); setEditorOpen(true); }}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Create first cadence
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => {
            const status = statusFor(c);
            const next = computeNextDue(c);
            const streak = streakFor(c.id);
            const dept = departments.find(d => d.id === c.department_id);
            const canEdit = isAdmin || c.owner_id === user?.id || c.created_by === user?.id;
            return (
              <Card key={c.id} className={cn("hover:shadow-sm transition-shadow", !c.is_active && "opacity-60")}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={cn("h-2 w-2 rounded-full shrink-0", statusDot[status])} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-medium text-sm truncate">{c.title}</h3>
                        <Badge variant="outline" className="text-[10px] gap-1">
                          <Calendar className="h-2.5 w-2.5" /> {cadenceLabel(c)}
                        </Badge>
                        {streak > 0 && (
                          <Badge variant="outline" className="text-[10px] gap-1 border-green-500/30 text-green-600">
                            <CheckCircle2 className="h-2.5 w-2.5" /> {streak} streak
                          </Badge>
                        )}
                        {dept && (
                          <Badge variant="secondary" className="text-[10px]">{dept.name}</Badge>
                        )}
                        {!c.is_active && <Badge variant="outline" className="text-[10px]">Paused</Badge>}
                      </div>
                      {c.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{c.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Avatar className="h-4 w-4"><AvatarFallback className="text-[8px]">{getName(c.owner_id).slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                          {getName(c.owner_id)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" /> Next: {format(next, "MMM d")}
                        </span>
                        {c.sop_doc_id && (
                          <Link to={`/docs?id=${c.sop_doc_id}`} className="flex items-center gap-1 hover:text-foreground">
                            <FileText className="h-3 w-3" /> SOP
                          </Link>
                        )}
                      </div>
                    </div>
                    {canEdit && (
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => toggleActive(c)} className="text-xs h-7">
                          {c.is_active ? "Pause" : "Resume"}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => { setEditing(c); setEditorOpen(true); }} className="text-xs h-7">
                          Edit
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => deleteCadence(c)} className="text-xs h-7 text-red-500 hover:text-red-600">
                          Delete
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <CadenceEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        cadence={editing}
        onSaved={() => { setEditorOpen(false); load(); }}
      />
    </div>
  );
}
