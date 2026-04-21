import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Target, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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

interface Profile { user_id: string; full_name: string | null; avatar_url: string | null; }

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

interface Props {
  departmentId: string;
  isAdmin: boolean;
}

export default function ScorecardSection({ departmentId, isAdmin }: Props) {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [createOpen, setCreateOpen] = useState(false);

  const currentWeek = mondayOf(new Date());
  const recentWeeks = weeksBack(4);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: deptOwners } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("department_id", departmentId);
    const ownerIds = (deptOwners || []).map(p => p.user_id);

    let query = supabase.from("scorecard_metrics").select("*").eq("is_active", true);
    const { data: mData } = await query;
    const filtered = (mData || []).filter(m =>
      m.department_id === departmentId ||
      (m.department_id === null && m.owner_id && ownerIds.includes(m.owner_id))
    );
    filtered.sort((a, b) => a.sort_order - b.sort_order);
    setMetrics(filtered);

    if (filtered.length > 0) {
      const ids = filtered.map(m => m.id);
      const earliest = recentWeeks[0];
      const { data: eData } = await supabase
        .from("scorecard_entries")
        .select("*")
        .in("metric_id", ids)
        .gte("week_start_date", earliest);
      setEntries(eData || []);
    } else {
      setEntries([]);
    }

    const { data: pData } = await supabase
      .from("profiles")
      .select("user_id, full_name, avatar_url");
    setProfiles(pData || []);
    setLoading(false);
  }, [departmentId]);

  useEffect(() => { load(); }, [load]);

  const entryFor = (metricId: string, week: string) =>
    entries.find(e => e.metric_id === metricId && e.week_start_date === week);

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

  const ownerProfile = (id: string | null) => profiles.find(p => p.user_id === id);

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">Scorecard</h3>
          <span className="text-xs text-muted-foreground">Week of {currentWeek}</span>
        </div>
        {isAdmin && (
          <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Add Metric
          </Button>
        )}
      </div>

      {loading ? (
        <div className="text-xs text-muted-foreground py-6 text-center">Loading…</div>
      ) : metrics.length === 0 ? (
        <div className="text-xs text-muted-foreground py-6 text-center">
          No scorecard metrics for this department yet.
          {isAdmin && " Click + Add Metric to create one."}
        </div>
      ) : (
        <div className="space-y-1.5">
          {/* Header */}
          <div className="grid grid-cols-[1.5fr_auto_auto_auto_auto] gap-3 px-2 pb-1 text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
            <div>Metric</div>
            <div className="text-right w-20">Target</div>
            <div className="text-right w-24">This Week</div>
            <div className="text-center w-24">Trend</div>
            <div className="text-center w-6">●</div>
          </div>
          {metrics.map(m => {
            const e = entryFor(m.id, currentWeek);
            const draftVal = draft[m.id] ?? (e?.actual_value != null ? String(e.actual_value) : "");
            const actual = draftVal === "" ? null : Number(draftVal);
            const onTrack = actual != null && actual >= Number(m.weekly_target);
            const owner = ownerProfile(m.owner_id);
            const recent = recentWeeks.map(w => entryFor(m.id, w)?.actual_value ?? 0);
            const max = Math.max(...recent, Number(m.weekly_target), 1);

            return (
              <div key={m.id} className="grid grid-cols-[1.5fr_auto_auto_auto_auto] gap-3 items-center px-2 py-2 rounded-md hover:bg-muted/40">
                <div className="flex items-center gap-2 min-w-0">
                  {owner && (
                    <Avatar className="h-6 w-6 shrink-0">
                      <AvatarImage src={owner.avatar_url || undefined} />
                      <AvatarFallback className="text-[10px]">
                        {(owner.full_name || "?").slice(0, 1)}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{m.name}</div>
                    {m.description && (
                      <div className="text-[11px] text-muted-foreground truncate">{m.description}</div>
                    )}
                  </div>
                </div>
                <div className="text-right text-sm tabular-nums w-20 text-muted-foreground">
                  {formatValue(m.weekly_target, m.unit)}
                </div>
                <div className="w-24">
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
                <div className="flex items-end justify-center gap-0.5 h-7 w-24">
                  {recent.map((v, i) => {
                    const h = Math.max(2, (v / max) * 24);
                    return (
                      <div
                        key={i}
                        className={cn(
                          "w-2 rounded-sm",
                          v >= Number(m.weekly_target) && v > 0 ? "bg-emerald-500/70" : v > 0 ? "bg-destructive/60" : "bg-muted",
                        )}
                        style={{ height: `${h}px` }}
                        title={`${recentWeeks[i]}: ${formatValue(v, m.unit)}`}
                      />
                    );
                  })}
                </div>
                <div className="flex justify-center w-6">
                  {actual == null ? (
                    <div className="h-2 w-2 rounded-full bg-muted" />
                  ) : onTrack ? (
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-destructive" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {createOpen && (
        <CreateMetricDialog
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          departmentId={departmentId}
          profiles={profiles}
          onSaved={() => { setCreateOpen(false); load(); }}
        />
      )}
    </Card>
  );
}

function CreateMetricDialog({
  open, onClose, departmentId, profiles, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  departmentId: string;
  profiles: Profile[];
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [ownerId, setOwnerId] = useState<string>("");
  const [target, setTarget] = useState("0");
  const [unit, setUnit] = useState("count");
  const [dataSource, setDataSource] = useState("manual");
  const [ghlKey, setGhlKey] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) { toast.error("Name is required"); return; }
    setSaving(true);
    const { data: prof } = await supabase.from("profiles").select("workspace_id").eq("department_id", departmentId).limit(1).maybeSingle();
    const { error } = await supabase.from("scorecard_metrics").insert({
      workspace_id: prof?.workspace_id ?? null,
      department_id: departmentId,
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
            <div className="space-y-1.5">
              <Label>Weekly Target</Label>
              <Input value={target} onChange={e => setTarget(e.target.value)} inputMode="decimal" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
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
              <Label>Data Source</Label>
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
