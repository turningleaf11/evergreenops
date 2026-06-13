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
  GitBranch,
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
type DeptStyle = { color: string; textClass: string; borderClass: string; dimBg: string };

function getDeptStyle(name: string): DeptStyle {
  const n = (name || "").toLowerCase();
  if (n.includes("dts") || n.includes("seller"))
    return { color: "#6366f1", textClass: "text-indigo-400", borderClass: "border-indigo-500/20", dimBg: "rgba(99,102,241,0.04)" };
  if (n.includes("dta") || n.includes("agent"))
    return { color: "#3b82f6", textClass: "text-blue-400", borderClass: "border-blue-500/20", dimBg: "rgba(59,130,246,0.04)" };
  if (n.includes("listing") || n.includes("hawk"))
    return { color: "#f59e0b", textClass: "text-amber-400", borderClass: "border-amber-500/20", dimBg: "rgba(245,158,11,0.04)" };
  if (n.includes("dispo") || n.includes("closer"))
    return { color: "#10b981", textClass: "text-emerald-400", borderClass: "border-emerald-500/20", dimBg: "rgba(16,185,129,0.04)" };
  if (n.includes("portfolio"))
    return { color: "#14b8a6", textClass: "text-teal-400", borderClass: "border-teal-500/20", dimBg: "rgba(20,184,166,0.04)" };
  return { color: "#64748b", textClass: "text-slate-400", borderClass: "border-border/40", dimBg: "rgba(100,116,139,0.03)" };
}

// ──────────────────────────────────────────────────────────────────────────────
// Business Funnel — layer classification
// ──────────────────────────────────────────────────────────────────────────────
type FunnelLayer = "activities" | "engagement" | "pipeline" | "outcome";

function getFunnelLayer(m: Metric): FunnelLayer | null {
  const key = (m.ghl_field_key || "").toLowerCase();
  const name = m.name.toLowerCase().trim();

  // Activities — inputs we control
  if (
    key === "calls:total_week" || key === "calls:total_week:team" || key === "calls:total_week:cara" ||
    key === "calls:connection_rate_week:team" || key === "calls:connection_rate_week:cara" ||
    name === "calls made" || name === "calls made — team" || name === "calls made — cara" ||
    name === "connection rate — team" || name === "connection rate — cara"
  ) return "activities";
  if (key === "seller:new_week") return "activities";

  // Engagement — seller top-of-funnel signal (no targets)
  if (key === "seller:stage:in outreach" || name.includes("in active outreach")) return "engagement";
  if (key === "seller:stage:replied" || name === "leads replied") return "engagement";
  if (
    key.startsWith("seller:stage:engaged") ||
    key.startsWith("seller:stage:warm") ||
    name.includes("warm / engaged") ||
    name.includes("warm/engaged") ||
    name.includes("engaged leads")
  ) return "engagement";

  // Pipeline — deal stages
  if (name === "appointments set") return "pipeline"; // DTS bridge to deals
  if (name === "in underwriting") return "pipeline";
  if (name === "offer sent") return "pipeline";
  if (name === "offers under negotiation" || name.includes("under negotiation")) return "pipeline";
  if (name === "under contract") return "pipeline";
  if (key === "dispo:active" || name === "active deals in escrow") return "pipeline";

  // Outcome — won deals
  if (key === "main:won_week" || name === "contracts signed") return "outcome";
  if (name === "deals closed") return "outcome"; // company-wide total only (not "portfolio deals closed")
  if (
    key === "dispo:won_count" || key === "dispo:win_rate" || key === "dispo:revenue" ||
    name === "deals closed — won" || name === "win rate" || name === "total revenue closed"
  ) return "outcome";

  return null;
}

const FUNNEL_LAYER_META: Record<FunnelLayer, {
  label: string;
  sublabel: string;
  color: string;
  bg: string;
  borderClass: string;
}> = {
  activities: {
    label: "Activities",
    sublabel: "What we control this week",
    color: "#6366f1",
    bg: "rgba(99,102,241,0.05)",
    borderClass: "border-indigo-500/25",
  },
  engagement: {
    label: "Engagement",
    sublabel: "Seller response from outreach",
    color: "#8b5cf6",
    bg: "rgba(139,92,246,0.03)",
    borderClass: "border-violet-500/15",
  },
  pipeline: {
    label: "Deal Pipeline",
    sublabel: "Active opportunities",
    color: "#3b82f6",
    bg: "rgba(59,130,246,0.04)",
    borderClass: "border-blue-500/20",
  },
  outcome: {
    label: "Outcome",
    sublabel: "Deals won",
    color: "#10b981",
    bg: "rgba(16,185,129,0.05)",
    borderClass: "border-emerald-500/25",
  },
};

const FUNNEL_LAYER_ORDER: FunnelLayer[] = ["activities", "engagement", "pipeline", "outcome"];

// ──────────────────────────────────────────────────────────────────────────────
// FunnelRow — individual metric with optional progress bar
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
  const hasTarget = target > 0;
  const hasEntry = entry !== undefined && actual !== null;
  const pct = hasTarget && hasEntry ? Math.min(Math.round((actual! / target) * 100), 100) : 0;
  const isOnTrack = hasTarget && hasEntry && actual! >= target;
  const isGhl = metric.data_source === "ghl";

  const barHex = !hasEntry || !hasTarget
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
    <div className="grid grid-cols-[240px_1fr_160px_80px] gap-3 items-center px-4 py-2.5 border-b border-border/[0.08] last:border-0 hover:bg-white/[0.012] group transition-colors">
      {/* Name */}
      <div className="min-w-0 pr-2">
        <p className="text-[13px] font-medium text-foreground/85 truncate leading-snug">{metric.name}</p>
        {metric.description && (
          <p className="text-[10px] text-muted-foreground/40 leading-tight mt-0.5">{metric.description}</p>
        )}
      </div>

      {/* Progress bar (only when target > 0) */}
      {hasTarget ? (
        <div className="h-[5px] bg-muted/15 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: barHex }} />
        </div>
      ) : (
        <div />
      )}

      {/* Actual / Target */}
      <div className="flex items-center justify-end gap-1.5 min-w-0">
        {editing ? (
          <>
            <Input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditing(false); }}
              className="h-6 w-16 text-xs text-right tabular-nums px-1.5"
              inputMode="decimal"
            />
            <button onClick={commitEdit} className="text-emerald-500 hover:text-emerald-400 shrink-0">
              <Check className="h-3 w-3" />
            </button>
            <button onClick={() => setEditing(false)} className="text-muted-foreground hover:text-foreground shrink-0">
              <X className="h-3 w-3" />
            </button>
          </>
        ) : (
          <>
            <span className={cn(
              "text-sm font-bold tabular-nums",
              !hasEntry ? "text-muted-foreground/20" : isOnTrack ? "text-emerald-400" : "text-foreground/75",
            )}>
              {formatValue(actual, metric.unit)}
            </span>
            {hasTarget && (
              <span className="text-[11px] text-muted-foreground/30 tabular-nums shrink-0">
                / {formatValue(target, metric.unit)}
              </span>
            )}
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
          <span className={cn("text-[10px] italic", isGhl ? "text-muted-foreground/25" : "text-muted-foreground/35")}>
            {isGhl ? "pending" : "—"}
          </span>
        ) : !hasTarget ? null : isOnTrack ? (
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
// CountCard — horizontal card for engagement-layer signal metrics (no target)
// ──────────────────────────────────────────────────────────────────────────────
function CountCard({
  metric,
  entry,
  onSave,
}: {
  metric: Metric;
  entry: Entry | undefined;
  onSave: (metricId: string, val: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const actual = entry?.actual_value ?? null;

  const commitEdit = async () => {
    await onSave(metric.id, draft);
    setEditing(false);
  };

  // Shorten long label for compact display
  const label = metric.name
    .replace(/^Leads\s+/i, "")
    .replace(/\s+Leads$/i, "");

  return (
    <div className="flex-1 px-5 py-4 text-center group">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground/40 font-semibold mb-2 truncate">
        {label}
      </p>
      {editing ? (
        <div className="flex items-center justify-center gap-1">
          <Input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditing(false); }}
            className="h-7 w-20 text-center text-sm tabular-nums px-1.5"
            inputMode="decimal"
          />
          <button onClick={commitEdit} className="text-emerald-500 hover:text-emerald-400">
            <Check className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => setEditing(false)} className="text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div
          className="flex items-baseline justify-center gap-1.5 cursor-pointer"
          onClick={() => { setDraft(actual != null ? String(actual) : ""); setEditing(true); }}
        >
          <span className={cn(
            "text-2xl font-bold tabular-nums",
            actual == null ? "text-muted-foreground/20" : "text-foreground/80",
          )}>
            {actual != null ? Number(actual).toLocaleString() : "—"}
          </span>
          <Pencil className="h-2.5 w-2.5 text-muted-foreground opacity-0 group-hover:opacity-40 transition-opacity mb-1 shrink-0" />
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// ConversionArrow — separator between funnel layers
// ──────────────────────────────────────────────────────────────────────────────
function ConversionArrow({ label, rate }: { label: string; rate: string | null }) {
  return (
    <div className="flex items-center gap-3 py-2.5 px-8">
      <div className="flex-1 h-px bg-border/15" />
      <div className="flex flex-col items-center gap-0.5 min-w-[80px]">
        <span className="text-[9px] uppercase tracking-[0.1em] text-muted-foreground/25 font-semibold">{label}</span>
        {rate && <span className="text-xs font-bold text-muted-foreground/45 tabular-nums">{rate}</span>}
        <span className="text-sm text-muted-foreground/15 leading-tight">↓</span>
      </div>
      <div className="flex-1 h-px bg-border/15" />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// BusinessFunnelView — full acquisition funnel
// ──────────────────────────────────────────────────────────────────────────────
function BusinessFunnelView({
  metrics,
  entries,
  currentWeek,
  onSave,
}: {
  metrics: Metric[];
  entries: Entry[];
  currentWeek: string;
  onSave: (metricId: string, val: string) => Promise<void>;
}) {
  const byLayer = useMemo(() => {
    const out: Record<FunnelLayer, Metric[]> = {
      activities: [], engagement: [], pipeline: [], outcome: [],
    };
    for (const m of metrics) {
      const layer = getFunnelLayer(m);
      if (layer) out[layer].push(m);
    }
    // Activities: New Leads Loaded always first, then other activity metrics
    out.activities.sort((a, b) => {
      const aFirst = a.ghl_field_key === "seller:new_week" ? -1 : 0;
      const bFirst = b.ghl_field_key === "seller:new_week" ? -1 : 0;
      if (aFirst !== bFirst) return aFirst - bFirst;
      return a.sort_order - b.sort_order;
    });
    return out;
  }, [metrics]);

  const entryFor = (metricId: string) =>
    entries.find((e) => e.metric_id === metricId && e.week_start_date === currentWeek);

  // Conversion rate helpers
  const getVal = useCallback((layer: FunnelLayer, fragment: string): number | null => {
    const m = byLayer[layer].find(
      (m) =>
        m.name.toLowerCase().includes(fragment.toLowerCase()) ||
        (m.ghl_field_key || "").toLowerCase().includes(fragment.toLowerCase()),
    );
    if (!m) return null;
    return entryFor(m.id)?.actual_value ?? null;
  }, [byLayer, entries, currentWeek]); // eslint-disable-line

  const pctRate = (n: number | null, d: number | null): string | null => {
    if (!n || !d || d === 0) return null;
    return `${Math.round((n / d) * 100)}%`;
  };

  const newLeads = getVal("activities", "new leads");
  const leadsReplied = getVal("engagement", "replied");
  const warmEngaged = getVal("engagement", "warm");
  const apptsSet = getVal("pipeline", "appointments set");
  const contractsSigned = getVal("outcome", "contracts signed");

  const conversionLabels: Record<string, { label: string; rate: string | null }> = {
    "activities→engagement": { label: "reply rate", rate: pctRate(leadsReplied, newLeads) },
    "engagement→pipeline":   { label: "appt rate",  rate: pctRate(apptsSet, warmEngaged) },
    "pipeline→outcome":      { label: "close rate",  rate: pctRate(contractsSigned, apptsSet) },
  };

  const visibleLayers = FUNNEL_LAYER_ORDER.filter((l) => byLayer[l].length > 0);

  if (visibleLayers.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
        No funnel metrics configured yet.
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {visibleLayers.map((layer, i) => {
        const meta = FUNNEL_LAYER_META[layer];
        const items = byLayer[layer];
        const prevLayer = i > 0 ? visibleLayers[i - 1] : null;
        const conv = prevLayer
          ? conversionLabels[`${prevLayer}→${layer}`] ?? { label: "", rate: null }
          : null;
        const isEngagement = layer === "engagement";

        return (
          <div key={layer}>
            {/* Conversion arrow between layers */}
            {prevLayer && conv && (
              <ConversionArrow label={conv.label} rate={conv.rate} />
            )}

            {/* Layer card */}
            <div
              className={cn("rounded-xl border overflow-hidden", meta.borderClass)}
              style={{ background: meta.bg }}
            >
              {/* Layer header */}
              <div
                className="flex items-center justify-between px-4 py-3"
                style={{ borderBottom: `1px solid ${meta.color}18` }}
              >
                <span className="text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: meta.color }}>
                  {meta.label}
                </span>
                <span className="text-[10px] text-muted-foreground/35 font-medium">{meta.sublabel}</span>
              </div>

              {/* Engagement: horizontal count cards */}
              {isEngagement ? (
                <div className="flex items-stretch divide-x divide-border/[0.06]">
                  {items.map((m) => (
                    <CountCard key={m.id} metric={m} entry={entryFor(m.id)} onSave={onSave} />
                  ))}
                </div>
              ) : (
                <>
                  {/* Column labels */}
                  <div
                    className="grid grid-cols-[240px_1fr_160px_80px] gap-3 px-4 py-1.5"
                    style={{ borderBottom: `1px solid ${meta.color}0d` }}
                  >
                    <span className="text-[9px] uppercase tracking-widest text-muted-foreground/25 font-semibold">Metric</span>
                    <span className="text-[9px] uppercase tracking-widest text-muted-foreground/25 font-semibold">Progress</span>
                    <span className="text-[9px] uppercase tracking-widest text-muted-foreground/25 font-semibold text-right">Actual / Target</span>
                    <span className="text-[9px] uppercase tracking-widest text-muted-foreground/25 font-semibold text-right">Status</span>
                  </div>
                  {items.map((m) => (
                    <FunnelRow
                      key={m.id}
                      metric={m}
                      entry={entryFor(m.id)}
                      accentColor={meta.color}
                      onSave={onSave}
                    />
                  ))}
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// PipelineFunnelSection — one per department (Pipeline Health tab)
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
    entries.find((e) => e.metric_id === metricId && e.week_start_date === currentWeek);

  const withData = items.filter((m) => entryFor(m.id)?.actual_value != null);
  // Only count metrics that have a target for on-track scoring
  const withTarget = withData.filter((m) => Number(m.weekly_target) > 0);
  const onTrackCount = withTarget.filter((m) => {
    const v = entryFor(m.id)!.actual_value!;
    return v >= Number(m.weekly_target);
  }).length;

  const hasGhl = items.some((m) => m.data_source === "ghl");
  const allPending = withData.length === 0 && hasGhl;

  return (
    <div className={cn("rounded-xl border overflow-hidden", style.borderClass)} style={{ background: style.dimBg }}>
      {/* Section header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${style.color}18` }}>
        <div className="flex items-center gap-2.5">
          <span className={cn("text-[11px] font-bold uppercase tracking-[0.12em]", style.textClass)}>{name}</span>
          <span className="text-[10px] text-muted-foreground/35 font-medium">
            {items.length} metric{items.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex items-center gap-2.5">
          {!allPending && withTarget.length > 0 && (
            <span className="text-[11px] text-muted-foreground/50">
              <span className={cn("font-semibold", onTrackCount === withTarget.length ? "text-emerald-400" : "text-foreground/60")}>
                {onTrackCount}
              </span>
              <span className="text-muted-foreground/40">/{withTarget.length} on track</span>
            </span>
          )}
          {allPending && <span className="text-[10px] text-muted-foreground/30 italic">awaiting sync</span>}
          {hasGhl && (
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/25 border border-border/15 rounded px-1.5 py-0.5">
              <Zap className="h-2.5 w-2.5" />GHL
            </span>
          )}
        </div>
      </div>

      {/* Column labels */}
      <div className="grid grid-cols-[240px_1fr_160px_80px] gap-3 px-4 py-1.5" style={{ borderBottom: `1px solid ${style.color}0d` }}>
        <span className="text-[9px] uppercase tracking-widest text-muted-foreground/25 font-semibold">Metric</span>
        <span className="text-[9px] uppercase tracking-widest text-muted-foreground/25 font-semibold">Progress</span>
        <span className="text-[9px] uppercase tracking-widest text-muted-foreground/25 font-semibold text-right">Actual / Target</span>
        <span className="text-[9px] uppercase tracking-widest text-muted-foreground/25 font-semibold text-right">Status</span>
      </div>

      {/* Metric rows */}
      {items.map((m) => (
        <FunnelRow key={m.id} metric={m} entry={entryFor(m.id)} accentColor={style.color} onSave={onSave} />
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
  const [trendRange, setTrendRange] = useState<"13w" | "all">("13w");

  const currentWeek = mondayOf(new Date());
  const last13Weeks = useMemo(() => weeksBack(13), []);

  // ── All unique weeks present in loaded entries ─────────────────────────────
  const allWeeksSorted = useMemo(() => {
    const weekSet = new Set(entries.map((e) => e.week_start_date));
    const sorted = Array.from(weekSet).sort();
    return sorted.length > 0 ? sorted : last13Weeks;
  }, [entries, last13Weeks]);

  // ── Active trend weeks based on selected range ─────────────────────────────
  const trendWeeks = useMemo(
    () => (trendRange === "all" ? allWeeksSorted : last13Weeks),
    [trendRange, allWeeksSorted, last13Weeks],
  );

  // ── Data loading ──────────────────────────────────────────────────────────
  const loadEntries = useCallback(async (mData: Metric[]) => {
    if (!mData.length) return [];
    // Load all entries (no date filter) — enables "all time" trend view
    const { data } = await supabase
      .from("scorecard_entries")
      .select("*")
      .in("metric_id", mData.map((m) => m.id))
      .order("week_start_date");
    return data || [];
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: mData }, { data: pData }] = await Promise.all([
      supabase.from("scorecard_metrics").select("*").eq("is_active", true).order("sort_order"),
      supabase.from("profiles").select("user_id, full_name, avatar_url, workspace_id"),
    ]);
    const m = mData || [];
    setMetrics(m);
    setProfiles(pData || []);
    const e = await loadEntries(m);
    setEntries(e);

    // Auto-sync GHL metrics missing current-week entries
    const missingGhl = m.some(
      (metric) =>
        metric.data_source === "ghl" &&
        !e.find((entry) => entry.metric_id === metric.id && entry.week_start_date === currentWeek),
    );
    if (missingGhl) {
      supabase.functions.invoke("scorecard-ghl-sync").then(async ({ data: sd }) => {
        if ((sd?.synced ?? 0) > 0) setEntries(await loadEntries(m));
      });
    }
    setLoading(false);
  }, [loadEntries, currentWeek]);

  useEffect(() => { load(); }, [load]);

  // ── Force sync ────────────────────────────────────────────────────────────
  const forceSyncGhl = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("scorecard-ghl-sync", { body: { force: true } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const synced = data?.synced ?? 0;
      const errList = data?.errors ?? [];
      const pipelines = data?.pipelinesFound ?? [];
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

  // ── Save entry (manual override) ─────────────────────────────────────────
  const saveEntry = async (metricId: string, raw: string) => {
    const value = raw === "" ? null : Number(raw);
    if (raw !== "" && Number.isNaN(value!)) return;
    const existing = entries.find((e) => e.metric_id === metricId && e.week_start_date === currentWeek);
    let err;
    if (existing) {
      ({ error: err } = await supabase
        .from("scorecard_entries")
        .update({ actual_value: value, entered_by: user?.id, entered_at: new Date().toISOString() })
        .eq("id", existing.id));
    } else {
      ({ error: err } = await supabase
        .from("scorecard_entries")
        .insert({ metric_id: metricId, week_start_date: currentWeek, actual_value: value, entered_by: user?.id }));
    }
    if (err) { toast.error(err.message); return; }
    setEntries(await loadEntries(metrics));
  };

  // ── Grouping (for Pipeline Health tab) ────────────────────────────────────
  const grouped = useMemo(() => {
    const groups = new Map<string, { name: string; deptId: string | null; items: Metric[] }>();
    for (const m of metrics) {
      const key = m.department_id || "__company__";
      if (!groups.has(key)) {
        const dept = departments.find((d) => d.id === m.department_id);
        groups.set(key, { name: dept?.name || "Company-Wide", deptId: m.department_id, items: [] });
      }
      groups.get(key)!.items.push(m);
    }
    const SECTION_PRIORITY: [string, number][] = [
      ["dts", 1], ["seller", 1], ["dta", 2], ["agent", 2],
      ["listing", 3], ["hawk", 3], ["main", 4], ["dispo", 5], ["portfolio", 6],
    ];
    const sectionRank = (name: string) => {
      const n = name.toLowerCase();
      for (const [key, rank] of SECTION_PRIORITY) { if (n.includes(key)) return rank; }
      return 99;
    };
    return Array.from(groups.values()).sort((a, b) => {
      if (!a.deptId && b.deptId) return 1;
      if (a.deptId && !b.deptId) return -1;
      const ra = sectionRank(a.name), rb = sectionRank(b.name);
      if (ra !== rb) return ra - rb;
      return a.name.localeCompare(b.name);
    });
  }, [metrics, departments]);

  // ── Summary stats (only metrics with targets) ─────────────────────────────
  const summary = useMemo(() => {
    let onTrack = 0, offTrack = 0, pending = 0;
    const trackedMetrics = metrics.filter((m) => Number(m.weekly_target) > 0);
    for (const m of trackedMetrics) {
      const e = entries.find((e) => e.metric_id === m.id && e.week_start_date === currentWeek);
      if (!e || e.actual_value == null) pending++;
      else if (e.actual_value >= Number(m.weekly_target)) onTrack++;
      else offTrack++;
    }
    const tracked = onTrack + offTrack;
    return {
      total: trackedMetrics.length,
      onTrack,
      offTrack,
      pending,
      pctOn: tracked > 0 ? Math.round((onTrack / tracked) * 100) : 0,
    };
  }, [metrics, entries, currentWeek]);

  // ── Trend metrics filter ──────────────────────────────────────────────────
  const trendMetrics =
    trendDeptFilter === "all"
      ? metrics
      : trendDeptFilter === "__company__"
      ? metrics.filter((m) => !m.department_id)
      : metrics.filter((m) => m.department_id === trendDeptFilter);

  // ── Guards ────────────────────────────────────────────────────────────────
  if (authLoading) return null;
  if (!isAdmin) return <Navigate to="/" replace />;

  const weekLabel = new Date(currentWeek + "T12:00:00").toLocaleDateString(undefined, {
    month: "long", day: "numeric", year: "numeric",
  });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Scorecard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Week of {weekLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={forceSyncGhl}
            disabled={syncing || loading}
            className="gap-1.5 h-8"
          >
            {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Sync GHL
          </Button>
          <Button onClick={() => setCreateOpen(true)} size="sm" className="gap-1.5 h-8">
            <Plus className="h-3.5 w-3.5" />
            Add Metric
          </Button>
        </div>
      </div>

      {/* ── Summary bar ─────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border/40 bg-card/50 p-5">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50 font-semibold mb-1">Tracked</p>
            <p className="text-3xl font-bold tabular-nums tracking-tight">{summary.total}</p>
          </div>
          <div className="h-10 w-px bg-border/30 hidden sm:block" />
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50 font-semibold mb-1">On Track</p>
            <p className="text-3xl font-bold tabular-nums tracking-tight text-emerald-400">{summary.onTrack}</p>
          </div>
          <div className="h-10 w-px bg-border/30 hidden sm:block" />
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50 font-semibold mb-1">Off Track</p>
            <p className="text-3xl font-bold tabular-nums tracking-tight text-red-400">{summary.offTrack}</p>
          </div>
          <div className="h-10 w-px bg-border/30 hidden sm:block" />
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50 font-semibold mb-1">Pending</p>
            <p className="text-3xl font-bold tabular-nums tracking-tight text-muted-foreground/35">{summary.pending}</p>
          </div>
          {summary.total > 0 && (
            <div className="flex-1 min-w-40 ml-2">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] text-muted-foreground/40 font-medium uppercase tracking-wide">Weekly Health</span>
                <span className={cn(
                  "text-[12px] font-bold tabular-nums",
                  summary.pctOn >= 80 ? "text-emerald-400" : summary.pctOn >= 50 ? "text-amber-400" : "text-red-400",
                )}>
                  {summary.pctOn}%
                </span>
              </div>
              <div className="h-2 bg-muted/20 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${(summary.onTrack / summary.total) * 100}%`,
                    backgroundColor: summary.pctOn >= 80 ? "#10b981" : summary.pctOn >= 50 ? "#f59e0b" : "#ef4444",
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <Tabs defaultValue="funnel" className="space-y-4">
        <TabsList>
          <TabsTrigger value="funnel" className="gap-1.5">
            <GitBranch className="h-3.5 w-3.5" />
            Business Funnel
          </TabsTrigger>
          <TabsTrigger value="health" className="gap-1.5">
            <Target className="h-3.5 w-3.5" />
            Pipeline Health
          </TabsTrigger>
          <TabsTrigger value="trends" className="gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" />
            Trends
          </TabsTrigger>
        </TabsList>

        {/* ── Business Funnel ──────────────────────────────────────────── */}
        <TabsContent value="funnel" className="space-y-0 mt-0">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground/40">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />Loading scorecard…
            </div>
          ) : (
            <BusinessFunnelView
              metrics={metrics}
              entries={entries}
              currentWeek={currentWeek}
              onSave={saveEntry}
            />
          )}
        </TabsContent>

        {/* ── Pipeline Health ──────────────────────────────────────────── */}
        <TabsContent value="health" className="space-y-3 mt-0">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground/40">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />Loading scorecard…
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
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs text-muted-foreground">Department:</span>
            <Select value={trendDeptFilter} onValueChange={setTrendDeptFilter}>
              <SelectTrigger className="w-56 h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                <SelectItem value="__company__">Company-Wide</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <span className="text-xs text-muted-foreground ml-auto">Range:</span>
            <div className="inline-flex rounded-lg border border-border/60 p-0.5 bg-muted/30">
              {(["13w", "all"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setTrendRange(r)}
                  className={cn(
                    "px-3 py-0.5 text-xs font-medium rounded-md transition-colors",
                    trendRange === r
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {r === "13w" ? "Last 13 weeks" : "All time"}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground/40">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />Loading…
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
                const deptName = departments.find((d) => d.id === m.department_id)?.name || "Company-Wide";
                const style = getDeptStyle(deptName);
                const weekVals = trendWeeks.map((w) => ({
                  week: w,
                  value: entries.find((e) => e.metric_id === m.id && e.week_start_date === w)?.actual_value ?? null,
                }));
                const max = Math.max(...weekVals.map((w) => w.value ?? 0), Number(m.weekly_target), 1);
                const latest = weekVals[weekVals.length - 1]?.value ?? null;
                const isOn = latest != null && Number(m.weekly_target) > 0 && latest >= Number(m.weekly_target);

                return (
                  <div
                    key={m.id}
                    className={cn("rounded-xl border p-4 space-y-3", style.borderClass)}
                    style={{ background: style.dimBg }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold truncate">{m.name}</p>
                        <p className="text-[10px] text-muted-foreground/40 mt-0.5">{deptName}</p>
                      </div>
                      {Number(m.weekly_target) > 0 && (
                        <div className="text-right shrink-0">
                          <p className="text-[9px] text-muted-foreground/40 uppercase tracking-wide">Target</p>
                          <p className="text-xs font-semibold tabular-nums">{formatValue(m.weekly_target, m.unit)}</p>
                        </div>
                      )}
                    </div>

                    {/* Bar chart */}
                    <div className="flex items-end justify-between gap-[2px] h-16">
                      {weekVals.map((w, i) => {
                        const h = w.value == null ? 3 : Math.max(3, (w.value / max) * 56);
                        const bg =
                          w.value == null
                            ? "bg-muted/15"
                            : Number(m.weekly_target) > 0 && w.value >= Number(m.weekly_target)
                            ? "bg-emerald-500/70"
                            : Number(m.weekly_target) > 0
                            ? "bg-destructive/50"
                            : "bg-blue-500/50";
                        return (
                          <div
                            key={i}
                            className={cn("flex-1 rounded-t-sm transition-all cursor-default", bg)}
                            style={{ height: `${h}px` }}
                            title={`${formatWeek(w.week)}: ${w.value == null ? "no data" : formatValue(w.value, m.unit)}`}
                          />
                        );
                      })}
                    </div>

                    {/* Foot row */}
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] text-muted-foreground/25 tabular-nums">
                        {trendWeeks.length > 0 ? formatWeek(trendWeeks[0]) : ""}
                      </span>
                      <span className={cn(
                        "text-sm font-bold tabular-nums",
                        isOn ? "text-emerald-400" : latest != null ? "text-foreground/70" : "text-muted-foreground/25",
                      )}>
                        {formatValue(latest, m.unit)}
                      </span>
                      <span className="text-[9px] text-muted-foreground/25 tabular-nums">
                        {trendWeeks.length > 0 ? formatWeek(trendWeeks[trendWeeks.length - 1]) : ""}
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
          workspaceId={profiles.find((p) => p.user_id === user?.id)?.workspace_id ?? null}
          onSaved={() => { setCreateOpen(false); load(); }}
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
      ghl_field_key: dataSource === "ghl" ? ghlKey.trim() || null : null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
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
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Cold Calls Made" />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Department</Label>
              <Select value={departmentId} onValueChange={setDepartmentId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__company__">Company-Wide</SelectItem>
                  {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Owner</Label>
              <Select value={ownerId} onValueChange={setOwnerId}>
                <SelectTrigger><SelectValue placeholder="Select owner" /></SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => <SelectItem key={p.user_id} value={p.user_id}>{p.full_name || "Unnamed"}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Weekly Target</Label>
              <Input value={target} onChange={(e) => setTarget(e.target.value)} inputMode="decimal" />
            </div>
            <div className="space-y-1.5">
              <Label>Unit</Label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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
                <SelectTrigger><SelectValue /></SelectTrigger>
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
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Create Metric"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
