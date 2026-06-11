import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDepartments } from "@/contexts/DepartmentsContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  Target,
  BarChart3,
  LineChart,
  RefreshCw,
  Loader2,
  Pencil,
  Check,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/shared/EmptyState";
import { Navigate } from "react-router-dom";

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────
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
interface Profile {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  workspace_id: string | null;
}
interface Dept {
  id: string;
  name: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────
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
  return Number(v).toLocaleString();
}

function formatWeek(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// Department colour palette
// ──────────────────────────────────────────────────────────────────────────────
type DeptStyle = {
  color: string;
  textClass: string;
  borderClass: string;
  dimBg: string;
};

function getDeptStyle(name: string): DeptStyle {
  const n = (name || "").toLowerCase();
  if (n.includes("dts") || n.includes("seller"))
    return {
      color: "#6366f1",
      textClass: "text-indigo-400",
      borderClass: "border-indigo-500/20",
      dimBg: "rgba(99,102,241,0.04)",
    };
  if (n.includes("dta") || n.includes("agent"))
    return {
      color: "#3b82f6",
      textClass: "text-blue-400",
      borderClass: "border-blue-500/20",
      dimBg: "rgba(59,130,246,0.04)",
    };
  if (n.includes("listing") || n.includes("hawk"))
    return {
      color: "#f59e0b",
      textClass: "text-amber-400",
      borderClass: "border-amber-500/20",
      dimBg: "rgba(245,158,11,0.04)",
    };
  if (n.includes("dispo") || n.includes("closer"))
    return {
      color: "#10b981",
      textClass: "text-emerald-400",
      borderClass: "border-emerald-500/20",
      dimBg: "rgba(16,185,129,0.04)",
    };
  if (n.includes("portfolio"))
    return {
      color: "#14b8a6",
      textClass: "text-teal-400",
      borderClass: "border-teal-500/20",
      dimBg: "rgba(20,184,166,0.04)",
    };
  return {
    color: "#64748b",
    textClass: "text-slate-400",
    borderClass: "border-border/40",
    dimBg: "rgba(100,116,139,0.03)",
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Funnel Row — individual metric with progress bar
// ──────────────────────────────────────────────────────────────────────────────
function FunnelRow({
  metric,
  entry,
  accentColor,
  onSave,
}: {
  metric: Metric;
  entry: Entry | undefined;
  accentColor: string;
  onSave: (metricId: string, val: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const actual = entry?.actual_value ?? null;
  const target = Number(metric.weekly_target);
  const hasEntry = entry !== undefined && actual !== null;
  const pct =
    hasEntry && target > 0
      ? Math.min(Math.round((actual! / target) * 100), 100)
      : 0;
  const isOnTrack = hasEntry && actual! >= target;
  const isGhl = metric.data_source === "ghl";

  // Bar colour: green = on-track, amber = close (≥70%), accent = struggling
  const barHex = !hasEntry
    ? "transparent"
    : isOnTrack
    ? "#10b981"
    : pct >= 70
    ? "#f59e0b"
    : accentColor;

  const startEdit = () => {
    setDraft(actual != null ? String(actual) : "");
    setEditing(true);
  };

  const commitEdit = async () => {
    await onSave(metric.id, draft);
    setEditing(false);
  };

  return (
    <div className="grid grid-cols-[180px_1fr_160px_80px] gap-3 items-center px-4 py-2.5 border-b border-border/[0.08] last:border-0 hover:bg-white/[0.012] group transition-colors">
      {/* Name */}
      <div className="min-w-0 pr-2">
        <p className="text-[13px] font-medium text-foreground/85 truncate leading-snug">
          {metric.name}
        </p>
        {metric.description && (
          <p className="text-[10px] text-muted-foreground/40 truncate leading-tight mt-0.5">
            {metric.description}
          </p>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-[5px] bg-muted/15 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: barHex }}
        />
      </div>

      {/* Actual / Target */}
      <div className="flex items-center justify-end gap-1.5 min-w-0">
        {editing ? (
          <>
            <Input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitEdit();
                if (e.key === "Escape") setEditing(false);
              }}
              className="h-6 w-16 text-xs text-right tabular-nums px-1.5"
              inputMode="decimal"
            />
            <button
              onClick={commitEdit}
              className="text-emerald-500 hover:text-emerald-400 shrink-0"
            >
              <Check className="h-3 w-3" />
            </button>
            <button
              onClick={() => setEditing(false)}
              className="text-muted-foreground hover:text-foreground shrink-0"
            >
              <X className="h-3 w-3" />
            </button>
          </>
        ) : (
          <>
            <span
              className={cn(
                "text-sm font-bold tabular-nums",
                !hasEntry
                  ? "text-muted-foreground/20"
                  : isOnTrack
                  ? "text-emerald-400"
                  : "text-foreground/75",
              )}
            >
              {formatValue(actual, metric.unit)}
            </span>
            <span className="text-[11px] text-muted-foreground/30 tabular-nums shrink-0">
              / {formatValue(target, metric.unit)}
            </span>
            <button
              onClick={startEdit}
              title="Override value"
              className="opacity-0 group-hover:opacity-50 hover:!opacity-100 text-muted-foreground ml-0.5 transition-opacity shrink-0"
            >
              <Pencil className="h-2.5 w-2.5" />
            </button>
          </>
        )}
      </div>

      {/* Status badge */}
      <div className="flex items-center justify-end">
        {!hasEntry ? (
          <span
            className={cn(
              "text-[10px] italic",
              isGhl ? "text-muted-foreground/25" : "text-muted-foreground/35",
            )}
          >
            {isGhl ? "pending" : "—"}
          </span>
        ) : isOnTrack ? (
          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400">
            ✓ On
          </span>
        ) : (
          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/10 text-red-400">
            ↓ Off
          </span>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Pipeline Funnel Section — one per department
// ──────────────────────────────────────────────────────────────────────────────
function PipelineFunnelSection({
  name,
  items,
  entries,
  currentWeek,
  onSave,
}: {
  name: string;
  items: Metric[];
  entries: Entry[];
  currentWeek: string;
  onSave: (metricId: string, val: string) => Promise<void>;
}) {
  const style = getDeptStyle(name);

  const entryFor = (metricId: string) =>
    entries.find(
      (e) => e.metric_id === metricId && e.week_start_date === currentWeek,
    );

  const withData = items.filter(
    (m) => entryFor(m.id)?.actual_value != null,
  );
  const onTrackCount = withData.filter((m) => {
    const v = entryFor(m.id)!.actual_value!;
    return v >= Number(m.weekly_target);
  }).length;

  const hasGhl = items.some((m) => m.data_source === "ghl");
  const allPending = withData.length === 0 && hasGhl;

  return (
    <div
      className={cn("rounded-xl border overflow-hidden", style.borderClass)}
      style={{ background: style.dimBg }}
    >
      {/* ── Section header ── */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: `1px solid ${style.color}18` }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="h-3.5 w-[3px] rounded-full shrink-0"
            style={{ backgroundColor: style.color }}
          />
          <span
            className={cn(
              "text-[11px] font-bold uppercase tracking-[0.12em]",
              style.textClass,
            )}
          >
            {name}
          </span>
          <span className="text-[10px] text-muted-foreground/35 font-medium">
            {items.length} metric{items.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex items-center gap-2.5">
          {!allPending && withData.length > 0 && (
            <span className="text-[11px] text-muted-foreground/50">
              <span
                className={cn(
                  "font-semibold",
                  onTrackCount === withData.length
                    ? "text-emerald-400"
                    : "text-foreground/60",
                )}
              >
                {onTrackCount}
              </span>
              <span className="text-muted-foreground/40">/{withData.length} on track</span>
            </span>
          )}
          {allPending && (
            <span className="text-[10px] text-muted-foreground/30 italic">
              awaiting sync
            </span>
          )}
          {hasGhl && (
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/25 border border-border/15 rounded px-1.5 py-0.5">
              <Zap className="h-2.5 w-2.5" />
              GHL
            </span>
          )}
        </div>
      </div>

      {/* ── Column labels ── */}
      <div
        className="grid grid-cols-[180px_1fr_160px_80px] gap-3 px-4 py-1.5"
        style={{ borderBottom: `1px solid ${style.color}0d` }}
      >
        <span className="text-[9px] uppercase tracking-widest text-muted-foreground/25 font-semibold">
          Metric
        </span>
        <span className="text-[9px] uppercase tracking-widest text-muted-foreground/25 font-semibold">
          Progress
        </span>
        <span className="text-[9px] uppercase tracking-widest text-muted-foreground/25 font-semibold text-right">
          Actual / Target
        </span>
        <span className="text-[9px] uppercase tracking-widest text-muted-foreground/25 font-semibold text-right">
          Status
        </span>
      </div>

      {/* ── Metric rows ── */}
      {items.map((m) => (
        <FunnelRow
          key={m.id}
          metric={m}
          entry={entryFor(m.id)}
          accentColor={style.color}
          onSave={onSave}
        />
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Main Page
// ──────────────────────────────────────────────────────────────────────────────
export default function ScorecardPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const { departments } = useDepartments();
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [trendDeptFilter, setTrendDeptFilter] = useState<string>("all");

  const currentWeek = mondayOf(new Date());
  const trendWeeks = useMemo(() => weeksBack(13), []);

  // ── Data loading ──────────────────────────────────────────────────────────
  const loadEntries = useCallback(
    async (mData: Metric[]) => {
      if (!mData.length) return [];
      const { data } = await supabase
        .from("scorecard_entries")
        .select("*")
        .in("metric_id", mData.map((m) => m.id))
        .gte("week_start_date", trendWeeks[0]);
      return data || [];
    },
    [trendWeeks],
  );

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: mData }, { data: pData }] = await Promise.all([
      supabase
        .from("scorecard_metrics")
        .select("*")
        .eq("is_active", true)
        .order("sort_order"),
      supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url, workspace_id"),
    ]);
    const m = mData || [];
    setMetrics(m);
    setProfiles(pData || []);
    const e = await loadEntries(m);
    setEntries(e);

    // Auto-sync GHL metrics that are missing current-week entries
    const missingGhl = m.some(
      (metric) =>
        metric.data_source === "ghl" &&
        !e.find(
          (entry) =>
            entry.metric_id === metric.id &&
            entry.week_start_date === currentWeek,
        ),
    );
    if (missingGhl) {
      supabase.functions.invoke("scorecard-ghl-sync").then(async ({ data: sd }) => {
        if ((sd?.synced ?? 0) > 0) {
          setEntries(await loadEntries(m));
        }
      });
    }
    setLoading(false);
  }, [loadEntries, currentWeek]);

  useEffect(() => { load(); }, [load]);

  // ── Force sync ────────────────────────────────────────────────────────────
  const forceSyncGhl = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "scorecard-ghl-sync",
        { body: { force: true } },
      );
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const synced = data?.synced ?? 0;
      const errList = data?.errors ?? [];
      const pipelines = data?.pipelinesFound ?? [];
      // Always reload entries so UI reflects latest DB state
      setEntries(await loadEntries(metrics));
      if (synced > 0) {
        toast.success(`Synced ${synced} metric${synced !== 1 ? "s" : ""} from GHL — pipelines: ${pipelines.join(", ")}`);
      } else if (errList.length) {
        toast.error(`Sync wrote 0s. Errors: ${errList.map((e: any) => e.error).slice(0, 2).join(" | ")}`, { duration: 10000 });
      } else {
        toast.info(`Sync ran — pipelines found: ${pipelines.join(", ") || "none"}`);
      }
    } catch (e: any) {
      toast.error("Sync failed: " + (e.message || "unknown error"));
    } finally {
      setSyncing(false);
    }
  };

  // ── Debug GHL (shows raw API response) ──────────────────────────────────
  const debugGhl = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "scorecard-ghl-sync",
        { body: { debug: true } },
      );
      if (error) throw error;
      console.log("GHL DEBUG RESPONSE:", JSON.stringify(data, null, 2));
      const pipes = (data?.pipelines ?? []) as Array<{ name: string; stageCount: number }>;
      const samples = data?.pipelineSamples ?? {};
      const summary = pipes.map((p: { name: string; stageCount: number }) => {
        const s = (samples as Record<string, { count?: number; error?: string }>)[p.name];
        return `${p.name}: ${s?.error ? "ERROR: " + s.error : (s?.count ?? "?") + " opps"}`;
      }).join("\n");
      toast.info(`GHL Pipelines:\n${summary || "none found"}`, { duration: 15000 });
    } catch (e: any) {
      toast.error("Debug failed: " + (e.message || "unknown error"));
    } finally {
      setSyncing(false);
    }
  };

  // ── Save entry (manual override) ─────────────────────────────────────────
  const saveEntry = async (metricId: string, raw: string) => {
    const value = raw === "" ? null : Number(raw);
    if (raw !== "" && Number.isNaN(value!)) return;
    const existing = entries.find(
      (e) => e.metric_id === metricId && e.week_start_date === currentWeek,
    );
    let err;
    if (existing) {
      ({ error: err } = await supabase
        .from("scorecard_entries")
        .update({
          actual_value: value,
          entered_by: user?.id,
          entered_at: new Date().toISOString(),
        })
        .eq("id", existing.id));
    } else {
      ({ error: err } = await supabase.from("scorecard_entries").insert({
        metric_id: metricId,
        week_start_date: currentWeek,
        actual_value: value,
        entered_by: user?.id,
      }));
    }
    if (err) { toast.error(err.message); return; }
    setEntries(await loadEntries(metrics));
  };

  // ── Grouping ──────────────────────────────────────────────────────────────
  const grouped = useMemo(() => {
    const groups = new Map<
      string,
      { name: string; deptId: string | null; items: Metric[] }
    >();
    for (const m of metrics) {
      const key = m.department_id || "__company__";
      if (!groups.has(key)) {
        const dept = departments.find((d) => d.id === m.department_id);
        groups.set(key, {
          name: dept?.name || "Company-Wide",
          deptId: m.department_id,
          items: [],
        });
      }
      groups.get(key)!.items.push(m);
    }
    return Array.from(groups.values()).sort((a, b) => {
      if (!a.deptId && b.deptId) return 1;
      if (a.deptId && !b.deptId) return -1;
      return a.name.localeCompare(b.name);
    });
  }, [metrics, departments]);

  // ── Summary stats ─────────────────────────────────────────────────────────
  const summary = useMemo(() => {
    let onTrack = 0,
      offTrack = 0,
      pending = 0;
    for (const m of metrics) {
      const e = entries.find(
        (e) => e.metric_id === m.id && e.week_start_date === currentWeek,
      );
      if (!e || e.actual_value == null) pending++;
      else if (e.actual_value >= Number(m.weekly_target)) onTrack++;
      else offTrack++;
    }
    const tracked = onTrack + offTrack;
    return {
      total: metrics.length,
      onTrack,
      offTrack,
      pending,
      pctOn: tracked > 0 ? Math.round((onTrack / tracked) * 100) : 0,
    };
  }, [metrics, entries, currentWeek]);

  // ── Trend metrics ─────────────────────────────────────────────────────────
  const trendMetrics =
    trendDeptFilter === "all"
      ? metrics
      : trendDeptFilter === "__company__"
      ? metrics.filter((m) => !m.department_id)
      : metrics.filter((m) => m.department_id === trendDeptFilter);

  // ── Guards ────────────────────────────────────────────────────────────────
  if (authLoading) return null;
  if (!isAdmin) return <Navigate to="/" replace />;

  const weekLabel = new Date(currentWeek + "T12:00:00").toLocaleDateString(
    undefined,
    { month: "long", day: "numeric", year: "numeric" },
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Scorecard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Week of {weekLabel}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={debugGhl}
            disabled={syncing || loading}
            className="gap-1.5 h-8 text-amber-600 border-amber-300 hover:bg-amber-50"
          >
            <Zap className="h-3.5 w-3.5" />
            Debug GHL
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={forceSyncGhl}
            disabled={syncing || loading}
            className="gap-1.5 h-8"
          >
            {syncing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Sync GHL
          </Button>
          <Button
            onClick={() => setCreateOpen(true)}
            size="sm"
            className="gap-1.5 h-8"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Metric
          </Button>
        </div>
      </div>

      {/* ── Summary bar ─────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border/40 bg-card/50 p-5">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50 font-semibold mb-1">
              Metrics
            </p>
            <p className="text-3xl font-bold tabular-nums tracking-tight">
              {summary.total}
            </p>
          </div>
          <div className="h-10 w-px bg-border/30 hidden sm:block" />
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50 font-semibold mb-1">
              On Track
            </p>
            <p className="text-3xl font-bold tabular-nums tracking-tight text-emerald-400">
              {summary.onTrack}
            </p>
          </div>
          <div className="h-10 w-px bg-border/30 hidden sm:block" />
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50 font-semibold mb-1">
              Off Track
            </p>
            <p className="text-3xl font-bold tabular-nums tracking-tight text-red-400">
              {summary.offTrack}
            </p>
          </div>
          <div className="h-10 w-px bg-border/30 hidden sm:block" />
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50 font-semibold mb-1">
              Pending
            </p>
            <p className="text-3xl font-bold tabular-nums tracking-tight text-muted-foreground/35">
              {summary.pending}
            </p>
          </div>
          {/* Weekly health bar */}
          {summary.total > 0 && (
            <div className="flex-1 min-w-40 ml-2">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] text-muted-foreground/40 font-medium uppercase tracking-wide">
                  Weekly Health
                </span>
                <span
                  className={cn(
                    "text-[12px] font-bold tabular-nums",
                    summary.pctOn >= 80
                      ? "text-emerald-400"
                      : summary.pctOn >= 50
                      ? "text-amber-400"
                      : "text-red-400",
                  )}
                >
                  {summary.pctOn}%
                </span>
              </div>
              <div className="h-2 bg-muted/20 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${(summary.onTrack / summary.total) * 100}%`,
                    backgroundColor:
                      summary.pctOn >= 80
                        ? "#10b981"
                        : summary.pctOn >= 50
                        ? "#f59e0b"
                        : "#ef4444",
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <Tabs defaultValue="week" className="space-y-4">
        <TabsList>
          <TabsTrigger value="week" className="gap-1.5">
            <Target className="h-3.5 w-3.5" />
            This Week
          </TabsTrigger>
          <TabsTrigger value="trends" className="gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" />
            Trends
          </TabsTrigger>
        </TabsList>

        {/* ── This Week ───────────────────────────────────────────────── */}
        <TabsContent value="week" className="space-y-3 mt-0">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground/40">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Loading scorecard…
            </div>
          ) : grouped.length === 0 ? (
            <Card className="p-12 text-center text-sm text-muted-foreground">
              No metrics yet. Click "Add Metric" to get started.
            </Card>
          ) : (
            grouped.map((group) => (
              <PipelineFunnelSection
                key={group.deptId || "__company__"}
                name={group.name}
                items={group.items}
                entries={entries}
                currentWeek={currentWeek}
                onSave={saveEntry}
              />
            ))
          )}
        </TabsContent>

        {/* ── Trends ──────────────────────────────────────────────────── */}
        <TabsContent value="trends" className="space-y-4 mt-0">
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">Department:</span>
            <Select value={trendDeptFilter} onValueChange={setTrendDeptFilter}>
              <SelectTrigger className="w-56 h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                <SelectItem value="__company__">Company-Wide</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground ml-auto">
              Last 13 weeks
            </span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground/40">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Loading…
            </div>
          ) : trendMetrics.length === 0 ? (
            <EmptyState
              icon={LineChart}
              title="No metrics to display"
              description="Select a different department or add metrics to start tracking trends."
              actionLabel="Add Metric"
              actionIcon={Plus}
              onAction={() => setCreateOpen(true)}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {trendMetrics.map((m) => {
                const deptName =
                  departments.find((d) => d.id === m.department_id)?.name ||
                  "Company-Wide";
                const style = getDeptStyle(deptName);
                const weekVals = trendWeeks.map((w) => ({
                  week: w,
                  value:
                    entries.find(
                      (e) =>
                        e.metric_id === m.id && e.week_start_date === w,
                    )?.actual_value ?? null,
                }));
                const max = Math.max(
                  ...weekVals.map((w) => w.value ?? 0),
                  Number(m.weekly_target),
                  1,
                );
                const latest = weekVals[weekVals.length - 1].value;
                const isOn =
                  latest != null && latest >= Number(m.weekly_target);
                return (
                  <div
                    key={m.id}
                    className={cn(
                      "rounded-xl border p-4 space-y-3",
                      style.borderClass,
                    )}
                    style={{ background: style.dimBg }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold truncate">
                          {m.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground/40 mt-0.5">
                          {deptName}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[9px] text-muted-foreground/40 uppercase tracking-wide">
                          Target
                        </p>
                        <p className="text-xs font-semibold tabular-nums">
                          {formatValue(m.weekly_target, m.unit)}
                        </p>
                      </div>
                    </div>
                    {/* Bar chart */}
                    <div className="flex items-end justify-between gap-[2px] h-16">
                      {weekVals.map((w, i) => {
                        const h =
                          w.value == null
                            ? 3
                            : Math.max(3, (w.value / max) * 56);
                        const bg =
                          w.value == null
                            ? "bg-muted/15"
                            : w.value >= Number(m.weekly_target)
                            ? "bg-emerald-500/70"
                            : "bg-destructive/50";
                        return (
                          <div
                            key={i}
                            className={cn(
                              "flex-1 rounded-t-sm transition-all cursor-default",
                              bg,
                            )}
                            style={{ height: `${h}px` }}
                            title={`${formatWeek(w.week)}: ${
                              w.value == null
                                ? "no data"
                                : formatValue(w.value, m.unit)
                            }`}
                          />
                        );
                      })}
                    </div>
                    {/* Foot row: date range + latest value */}
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] text-muted-foreground/25 tabular-nums">
                        {formatWeek(trendWeeks[0])}
                      </span>
                      <span
                        className={cn(
                          "text-sm font-bold tabular-nums",
                          isOn
                            ? "text-emerald-400"
                            : latest != null
                            ? "text-foreground/70"
                            : "text-muted-foreground/25",
                        )}
                      >
                        {formatValue(latest, m.unit)}
                      </span>
                      <span className="text-[9px] text-muted-foreground/25 tabular-nums">
                        {formatWeek(trendWeeks[trendWeeks.length - 1])}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Create metric dialog ─────────────────────────────────────── */}
      {createOpen && (
        <CreateMetricDialog
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          departments={departments}
          profiles={profiles}
          workspaceId={
            profiles.find((p) => p.user_id === user?.id)?.workspace_id ?? null
          }
          onSaved={() => {
            setCreateOpen(false);
            load();
          }}
        />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Create Metric Dialog
// ──────────────────────────────────────────────────────────────────────────────
function CreateMetricDialog({
  open,
  onClose,
  departments,
  profiles,
  workspaceId,
  onSaved,
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
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("scorecard_metrics").insert({
      workspace_id: workspaceId,
      department_id:
        departmentId === "__company__" ? null : departmentId,
      name: name.trim(),
      description: description.trim() || null,
      owner_id: ownerId || null,
      weekly_target: Number(target) || 0,
      unit,
      data_source: dataSource,
      ghl_field_key:
        dataSource === "ghl" ? ghlKey.trim() || null : null,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Metric created");
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Scorecard Metric</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Cold Calls Made"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Department</Label>
              <Select value={departmentId} onValueChange={setDepartmentId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__company__">Company-Wide</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Owner</Label>
              <Select value={ownerId} onValueChange={setOwnerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select owner" />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => (
                    <SelectItem key={p.user_id} value={p.user_id}>
                      {p.full_name || "Unnamed"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Weekly Target</Label>
              <Input
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                inputMode="decimal"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Unit</Label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="count">Count</SelectItem>
                  <SelectItem value="$">$ Currency</SelectItem>
                  <SelectItem value="%">% Percent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Source</Label>
              <Select value={dataSource} onValueChange={setDataSource}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="ghl">GHL (auto-sync)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {dataSource === "ghl" && (
            <div className="space-y-1.5">
              <Label>GHL Field Key</Label>
              <Input
                value={ghlKey}
                onChange={(e) => setGhlKey(e.target.value)}
                placeholder="e.g. seller:new_week or seller:stage:Replied"
                className="font-mono text-sm"
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Create Metric"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
