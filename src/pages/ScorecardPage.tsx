import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDepartments } from "@/contexts/DepartmentsContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, ChevronDown, Target, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Navigate } from "react-router-dom";

interface Metric {
  id: string;
  workspace_id: string | null;
  department_id: string | null;
  name: string;
  description: string | null;
  owner_id: string | null;
  weekly_target: number;
  unit: string;
  data_source: string;
  ghl_field_key: string | null;
  is_active: boolean;
  sort_order: number;
}
interface Entry {
  id: string;
  metric_id: string;
  week_start_date: string;
  actual_value: number | null;
}
interface Profile { user_id: string; full_name: string | null; avatar_url: string | null; workspace_id: string | null; }
interface Dept { id: string; name: string; }

function mondayOf(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}
function weeksBack(n: number): string[] {
  const out: string[] = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i * 7);
    out.push(mondayOf(d));
  }
  return out;
}
function formatValue(v: number | null | undefined, unit: string): string {
  if (v == null) return "—";
  if (unit === "$") return `$${Number(v).toLocaleString()}`;
  if (unit === "%") return `${v}%`;
  return String(v);
}
function formatWeek(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function ScorecardPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const { departments } = useDepartments();
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [trendDeptFilter, setTrendDeptFilter] = useState<string>("all");

  const currentWeek = mondayOf(new Date());
  const trendWeeks = useMemo(() => weeksBack(13), []);

  const load = useCallback(async () => {
    setLoading(true);
    const earliest = trendWeeks[0];
    const [{ data: mData }, { data: pData }] = await Promise.all([
      supabase.from("scorecard_metrics").select("*").eq("is_active", true).order("sort_order"),
      supabase.from("profiles").select("user_id, full_name, avatar_url, workspace_id"),
    ]);
    setMetrics(mData || []);
    setProfiles(pData || []);
    if (mData && mData.length) {
      const { data: eData } = await supabase
        .from("scorecard_entries")
        .select("*")
        .in("metric_id", mData.map(m => m.id))
        .gte("week_start_date", earliest);
      setEntries(eData || []);

      // Auto-sync GHL-sourced metrics for the current week (non-blocking)
      const week = mondayOf(new Date());
      const ghlMissing = mData.some((m: any) =>
        m.data_source === "ghl" && !(eData || []).find((e: any) => e.metric_id === m.id && e.week_start_date === week),
      );
      if (ghlMissing) {
        supabase.functions.invoke("scorecard-ghl-sync").then(({ data }) => {
          if (data?.synced > 0) {
            supabase.from("scorecard_entries").select("*")
              .in("metric_id", mData.map((m: any) => m.id))
              .gte("week_start_date", earliest)
              .then(({ data: refreshed }) => setEntries(refreshed || []));
          }
        });
      }
    } else {
      setEntries([]);
    }
    setLoading(false);
  }, [trendWeeks]);

  useEffect(() => { load(); }, [load]);

  const entryFor = (metricId: string, week: string) =>
    entries.find(e => e.metric_id === metricId && e.week_start_date === week);

  const ownerProfile = (id: string | null) => profiles.find(p => p.user_id === id);
  const deptName = (id: string | null) => departments.find(d => d.id === id)?.name || "Company-Wide";

  const saveEntry = async (metricId: string, raw: string) => {
    const value = raw === "" ? null : Number(raw);
    if (raw !== "" && Number.isNaN(value!)) return;
    const existing = entryFor(metricId, currentWeek);
    if (existing) {
      const { error } = await supabase
        .from("scorecard_entries")
        .update({ actual_value: value, entered_by: user?.id, entered_at: new Date().toISOString() })
        .eq("id", existing.id);
      if (error) { toast.error(error.message); return; }
    } else {
      const { error } = await supabase
        .from("scorecard_entries")
        .insert({ metric_id: metricId, week_start_date: currentWeek, actual_value: value, entered_by: user?.id });
      if (error) { toast.error(error.message); return; }
    }
    load();
  };

  // Group metrics by department for This Week tab
  const grouped = useMemo(() => {
    const groups = new Map<string, { name: string; deptId: string | null; items: Metric[] }>();
    for (const m of metrics) {
      const key = m.department_id || "__company__";
      if (!groups.has(key)) {
        groups.set(key, { name: deptName(m.department_id), deptId: m.department_id, items: [] });
      }
      groups.get(key)!.items.push(m);
    }
    return Array.from(groups.values()).sort((a, b) => {
      if (!a.deptId) return -1;
      if (!b.deptId) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [metrics, departments]);

  // Summary
  const summary = useMemo(() => {
    let onTrack = 0, offTrack = 0, noEntry = 0;
    for (const m of metrics) {
      const v = entryFor(m.id, currentWeek)?.actual_value;
      if (v == null) noEntry++;
      else if (v >= Number(m.weekly_target)) onTrack++;
      else offTrack++;
    }
    const total = metrics.length;
    const tracked = onTrack + offTrack;
    return {
      total,
      onTrack,
      offTrack,
      noEntry,
      pctOn: tracked ? Math.round((onTrack / tracked) * 100) : 0,
      pctOff: tracked ? Math.round((offTrack / tracked) * 100) : 0,
    };
  }, [metrics, entries, currentWeek]);

  const trendMetrics = trendDeptFilter === "all"
    ? metrics
    : trendDeptFilter === "__company__"
    ? metrics.filter(m => !m.department_id)
    : metrics.filter(m => m.department_id === trendDeptFilter);

  if (authLoading) return null;
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Scorecard</h1>
          <p className="text-sm text-muted-foreground">Weekly performance metrics across the company</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" /> Add Metric
        </Button>
      </div>

      <Tabs defaultValue="week" className="space-y-4">
        <TabsList>
          <TabsTrigger value="week" className="gap-1.5"><Target className="h-3.5 w-3.5" /> This Week</TabsTrigger>
          <TabsTrigger value="trends" className="gap-1.5"><BarChart3 className="h-3.5 w-3.5" /> Trends</TabsTrigger>
        </TabsList>

        {/* THIS WEEK */}
        <TabsContent value="week" className="space-y-4">
          {/* Summary bar */}
          <Card className="p-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Total Metrics</div>
                <div className="text-4xl font-bold tabular-nums mt-1 tracking-tight">{summary.total}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">On Track</div>
                <div className="text-4xl font-bold tabular-nums mt-1 tracking-tight text-emerald-500">
                  {summary.pctOn}% <span className="text-sm text-muted-foreground font-normal">({summary.onTrack})</span>
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Off Track</div>
                <div className="text-4xl font-bold tabular-nums mt-1 tracking-tight text-destructive">
                  {summary.pctOff}% <span className="text-sm text-muted-foreground font-normal">({summary.offTrack})</span>
                </div>
              </div>
            </div>
            {summary.total > 0 && (
              <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="bg-emerald-500" style={{ width: `${(summary.onTrack / summary.total) * 100}%` }} />
                <div className="bg-destructive" style={{ width: `${(summary.offTrack / summary.total) * 100}%` }} />
              </div>
            )}
          </Card>

          {loading ? (
            <div className="text-sm text-muted-foreground py-12 text-center">Loading…</div>
          ) : grouped.length === 0 ? (
            <Card className="p-12 text-center text-sm text-muted-foreground">
              No scorecard metrics yet. Click "Add Metric" to create one.
            </Card>
          ) : (
            grouped.map(group => (
              <Collapsible key={group.deptId || "company"} defaultOpen className="group">
                <Card className="overflow-hidden">
                  <CollapsibleTrigger className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors">
                    <div className="flex items-center gap-2">
                      <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=closed]:-rotate-90" />
                      <span className="font-medium text-sm">{group.name}</span>
                      <span className="text-xs text-muted-foreground">{group.items.length} metric{group.items.length === 1 ? "" : "s"}</span>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="border-t border-border/50">
                      <div className="grid grid-cols-[1.5fr_auto_auto_auto] gap-3 px-4 py-2 text-[10px] uppercase tracking-wide text-muted-foreground font-medium border-b border-border/50">
                        <div>Metric</div>
                        <div className="text-right w-24">Target</div>
                        <div className="text-right w-28">This Week</div>
                        <div className="text-center w-20">Status</div>
                      </div>
                      {group.items.map(m => {
                        const e = entryFor(m.id, currentWeek);
                        const draftVal = draft[m.id] ?? (e?.actual_value != null ? String(e.actual_value) : "");
                        const actual = draftVal === "" ? null : Number(draftVal);
                        const onTrack = actual != null && actual >= Number(m.weekly_target);
                        const owner = ownerProfile(m.owner_id);
                        return (
                          <div key={m.id} className="grid grid-cols-[1.5fr_auto_auto_auto] gap-3 items-center px-4 py-2.5 border-b border-border/30 last:border-0 hover:bg-muted/30">
                            <div className="flex items-center gap-2 min-w-0">
                              {owner && (
                                <Avatar className="h-6 w-6 shrink-0">
                                  <AvatarImage src={owner.avatar_url || undefined} />
                                  <AvatarFallback className="text-[10px]">{(owner.full_name || "?").slice(0, 1)}</AvatarFallback>
                                </Avatar>
                              )}
                              <div className="min-w-0">
                                <div className="text-sm font-medium truncate">{m.name}</div>
                                {m.description && <div className="text-[11px] text-muted-foreground truncate">{m.description}</div>}
                              </div>
                            </div>
                            <div className="text-right text-sm tabular-nums w-24 text-muted-foreground">
                              {formatValue(m.weekly_target, m.unit)}
                            </div>
                            <div className="w-28">
                              <Input
                                value={draftVal}
                                onChange={(ev) => setDraft(d => ({ ...d, [m.id]: ev.target.value }))}
                                onBlur={(ev) => {
                                  const v = ev.target.value;
                                  const original = e?.actual_value != null ? String(e.actual_value) : "";
                                  if (v !== original) saveEntry(m.id, v);
                                }}
                                placeholder="0"
                                className="h-7 text-sm text-right tabular-nums"
                                inputMode="decimal"
                              />
                            </div>
                            <div className="flex justify-center w-20">
                              {actual == null ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground">—</span>
                              ) : onTrack ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">On Track</span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-destructive/15 text-destructive">Off Track</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            ))
          )}
        </TabsContent>

        {/* TRENDS */}
        <TabsContent value="trends" className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">Filter:</span>
            <Select value={trendDeptFilter} onValueChange={setTrendDeptFilter}>
              <SelectTrigger className="w-56 h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                <SelectItem value="__company__">Company-Wide</SelectItem>
                {departments.map(d => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground ml-auto">Last 13 weeks</span>
          </div>

          {loading ? (
            <div className="text-sm text-muted-foreground py-12 text-center">Loading…</div>
          ) : trendMetrics.length === 0 ? (
            <Card className="p-12 text-center text-sm text-muted-foreground">No metrics to display.</Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {trendMetrics.map(m => {
                const owner = ownerProfile(m.owner_id);
                const weekValues = trendWeeks.map(w => ({
                  week: w,
                  value: entryFor(m.id, w)?.actual_value ?? null,
                }));
                const max = Math.max(
                  ...weekValues.map(w => w.value ?? 0),
                  Number(m.weekly_target),
                  1,
                );
                return (
                  <Card key={m.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">{m.name}</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">{deptName(m.department_id)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Target</div>
                        <div className="text-sm font-medium tabular-nums">{formatValue(m.weekly_target, m.unit)}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {owner && (
                        <>
                          <Avatar className="h-5 w-5">
                            <AvatarImage src={owner.avatar_url || undefined} />
                            <AvatarFallback className="text-[9px]">{(owner.full_name || "?").slice(0, 1)}</AvatarFallback>
                          </Avatar>
                          <span className="text-[11px] text-muted-foreground">{owner.full_name || "Unassigned"}</span>
                        </>
                      )}
                    </div>
                    <div className="relative pt-1">
                      <div className="flex items-end justify-between gap-1 h-24">
                        {weekValues.map((w, i) => {
                          const h = w.value == null ? 4 : Math.max(3, (w.value / max) * 88);
                          const color = w.value == null
                            ? "bg-muted"
                            : w.value >= Number(m.weekly_target)
                            ? "bg-emerald-500/80 hover:bg-emerald-500"
                            : "bg-destructive/70 hover:bg-destructive";
                          return (
                            <div
                              key={i}
                              className={cn("flex-1 rounded-t transition-colors cursor-default", color)}
                              style={{ height: `${h}px` }}
                              title={`${formatWeek(w.week)} · ${w.value == null ? "No entry" : formatValue(w.value, m.unit)}`}
                            />
                          );
                        })}
                      </div>
                      <div className="flex justify-between mt-1.5 text-[9px] text-muted-foreground tabular-nums">
                        <span>{formatWeek(weekValues[0].week)}</span>
                        <span>{formatWeek(weekValues[weekValues.length - 1].week)}</span>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {createOpen && (
        <CreateMetricDialog
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          departments={departments}
          profiles={profiles}
          workspaceId={profiles.find(p => p.user_id === user?.id)?.workspace_id ?? null}
          onSaved={() => { setCreateOpen(false); load(); }}
        />
      )}
    </div>
  );
}

function CreateMetricDialog({
  open, onClose, departments, profiles, workspaceId, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  departments: Dept[];
  profiles: Profile[];
  workspaceId: string | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [departmentId, setDepartmentId] = useState<string>("__company__");
  const [ownerId, setOwnerId] = useState<string>("");
  const [target, setTarget] = useState("0");
  const [unit, setUnit] = useState("count");
  const [dataSource, setDataSource] = useState("manual");
  const [ghlKey, setGhlKey] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) { toast.error("Name is required"); return; }
    setSaving(true);
    const { error } = await supabase.from("scorecard_metrics").insert({
      workspace_id: workspaceId,
      department_id: departmentId === "__company__" ? null : departmentId,
      name: name.trim(),
      description: description.trim() || null,
      owner_id: ownerId || null,
      weekly_target: Number(target) || 0,
      unit,
      data_source: dataSource,
      ghl_field_key: dataSource === "ghl" ? (ghlKey.trim() || null) : null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Metric created");
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>New Scorecard Metric</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Cold Calls Made" />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Department</Label>
              <Select value={departmentId} onValueChange={setDepartmentId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__company__">Company-Wide</SelectItem>
                  {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Owner</Label>
              <Select value={ownerId} onValueChange={setOwnerId}>
                <SelectTrigger><SelectValue placeholder="Select owner" /></SelectTrigger>
                <SelectContent>
                  {profiles.map(p => (
                    <SelectItem key={p.user_id} value={p.user_id}>{p.full_name || "Unnamed"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Weekly Target</Label>
              <Input value={target} onChange={e => setTarget(e.target.value)} inputMode="decimal" />
            </div>
            <div className="space-y-1.5">
              <Label>Unit</Label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="count">Count</SelectItem>
                  <SelectItem value="$">$ (Currency)</SelectItem>
                  <SelectItem value="%">% (Percent)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Source</Label>
              <Select value={dataSource} onValueChange={setDataSource}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="ghl">Pull from GHL</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {dataSource === "ghl" && (
            <div className="space-y-1.5">
              <Label>GHL Field Key</Label>
              <Input value={ghlKey} onChange={e => setGhlKey(e.target.value)} placeholder="e.g. opportunities_won" />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Create Metric"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
