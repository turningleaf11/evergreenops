import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  RefreshCw, Loader2, TrendingUp, Users, MessageSquare,
  FileText, PenLine, CheckCircle, Building2, Phone, Mail, Smartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ── Types ───────────────────────────────────────────────────
type GhlKpis = {
  period: string;
  periodLabel: string;
  generatedAt: string;
  note?: string;
  wholesale: {
    leadsBySource: { tag: string; label: string; count: number }[];
    conversations: { total: number; sms: number; phone: number; email: number };
    funnel: {
      newOppsInPeriod: number;
      offersSubmitted: number;
      negotiating: number;
      contractsSigned: number;
      dealsClosed: number;
    };
  };
  portfolio: {
    newDealsInPeriod: number;
    funnel: {
      newAndGathering: number;
      passedNapkin: number;
      offerSent: number;
      dealsClosed: number;
    };
  };
};

// ── Period options ───────────────────────────────────────────
const PERIODS = [
  { value: "today",       label: "Today" },
  { value: "yesterday",   label: "Yesterday" },
  { value: "this_week",   label: "This Week" },
  { value: "last_week",   label: "Last Week" },
  { value: "this_month",  label: "This Month" },
  { value: "last_month",  label: "Last Month" },
  { value: "this_qtr",    label: "This Quarter" },
  { value: "last_qtr",    label: "Last Quarter" },
  { value: "this_year",   label: "This Year" },
  { value: "last_year",   label: "Last Year" },
  { value: "all",         label: "All Time" },
];

// ── Sub-components ───────────────────────────────────────────
function KpiTile({
  label, value, icon: Icon, accent = false, sub,
}: {
  label: string;
  value: number | null;
  icon: React.ElementType;
  accent?: boolean;
  sub?: string;
}) {
  return (
    <div className={cn(
      "rounded-xl border p-4 flex flex-col gap-1",
      accent ? "border-primary/30 bg-primary/[0.06]" : "border-border/50 bg-card/60",
    )}>
      <div className="flex items-center gap-1.5 text-muted-foreground mb-0.5">
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span className="text-[11px] font-medium uppercase tracking-wide leading-tight">{label}</span>
      </div>
      <p className={cn("text-2xl font-bold tabular-nums", accent ? "text-primary" : "text-foreground")}>
        {value == null
          ? <span className="text-muted-foreground/40 text-base italic font-normal">—</span>
          : value.toLocaleString()}
      </p>
      {sub && <p className="text-[10px] text-muted-foreground/50 leading-tight">{sub}</p>}
    </div>
  );
}

function FunnelBar({
  label, value, max, color,
}: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(Math.round((value / max) * 100), 100) : 0;
  return (
    <div className="flex items-center gap-3 py-0.5">
      <span className="text-xs text-muted-foreground w-40 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-muted/40 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs font-semibold tabular-nums w-10 text-right">{value.toLocaleString()}</span>
    </div>
  );
}

function relTime(iso: string): string {
  const diff = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1) return "just now";
  if (diff < 60) return `${diff}m ago`;
  return `${Math.round(diff / 60)}h ago`;
}

// ── Main component ───────────────────────────────────────────
export function GhlKpiBoard() {
  const [period, setPeriod] = useState("this_month");
  const [data, setData] = useState<GhlKpis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (p: string) => {
    setLoading(true);
    setError(null);
    try {
      const { data: result, error: err } = await supabase.functions.invoke("ghl-kpis", {
        body: {},
        headers: { "x-period": p },
      });
      if (err) throw err;
      if (result?.error) throw new Error(result.error);
      setData(result as GhlKpis);
    } catch (e: any) {
      setError(e.message || "Failed to load GHL data");
    } finally {
      setLoading(false);
    }
  }, []);

  // Pass period as query param via the function URL instead
  const loadWithPeriod = useCallback(async (p: string) => {
    setLoading(true);
    setError(null);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      const supabaseUrl = (supabase as any).supabaseUrl as string;
      const res = await fetch(`${supabaseUrl}/functions/v1/ghl-kpis?period=${p}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: (supabase as any).supabaseKey as string,
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      if (result?.error) throw new Error(result.error);
      setData(result as GhlKpis);
    } catch (e: any) {
      setError(e.message || "Failed to load GHL data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadWithPeriod(period); }, [period]);

  return (
    <div className="space-y-5">
      {/* Header + period selector */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse shrink-0" />
            GHL Live Metrics
          </h3>
          {data?.generatedAt && (
            <p className="text-[11px] text-muted-foreground/60 mt-0.5">
              Updated {relTime(data.generatedAt)}
              {data.note && <span className="ml-2 text-amber-500/80">· Lead counts = all-time</span>}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="text-xs bg-muted/50 border border-border/50 rounded-lg px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          >
            {PERIODS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          <Button
            size="icon" variant="ghost"
            onClick={() => loadWithPeriod(period)}
            disabled={loading}
            className="h-7 w-7 shrink-0"
          >
            {loading
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <RefreshCw className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
          {error}
        </div>
      )}

      {loading && !data && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-muted/40 animate-pulse" />
          ))}
        </div>
      )}

      {data && (
        <div className={cn("space-y-6 transition-opacity", loading && "opacity-60 pointer-events-none")}>

          {/* ── Wholesale ──────────────────────────────────── */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-3.5 w-3.5 text-primary" />
              <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Wholesale — {data.periodLabel}
              </h4>
            </div>

            {/* Leads by source (all-time) */}
            {data.wholesale.leadsBySource.length > 0 && (
              <div className="rounded-xl border border-border/40 bg-card/40 p-4 mb-3">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-2.5">
                  Leads by Source <span className="text-muted-foreground/50 normal-case font-normal">(all-time totals)</span>
                </p>
                <div className="space-y-1.5">
                  {data.wholesale.leadsBySource.map(({ label, count }) => {
                    const max = data.wholesale.leadsBySource[0]?.count || 1;
                    const pct = Math.min(Math.round((count / max) * 100), 100);
                    return (
                      <div key={label} className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-24 shrink-0">{label}</span>
                        <div className="flex-1 h-1.5 bg-muted/40 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-primary/60 transition-all duration-700" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs font-semibold tabular-nums w-12 text-right">{count.toLocaleString()}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* KPI tiles */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
              <KpiTile
                label="New Opps"
                value={data.wholesale.funnel.newOppsInPeriod}
                icon={Users}
                accent
                sub={period === 'all' ? 'Total in pipeline' : `Created ${data.periodLabel.toLowerCase()}`}
              />
              <KpiTile
                label="Offers Out"
                value={data.wholesale.funnel.offersSubmitted}
                icon={FileText}
                sub="Current pipeline stage"
              />
              <KpiTile
                label="Negotiating"
                value={data.wholesale.funnel.negotiating}
                icon={PenLine}
              />
              <KpiTile
                label="Contracts"
                value={data.wholesale.funnel.contractsSigned}
                icon={PenLine}
              />
              <KpiTile
                label="Deals Closed"
                value={data.wholesale.funnel.dealsClosed}
                icon={CheckCircle}
                accent
              />
              <div className="rounded-xl border border-border/50 bg-card/60 p-4">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Conversations
                </p>
                <p className="text-2xl font-bold tabular-nums text-foreground mb-1.5">
                  {data.wholesale.conversations.total.toLocaleString()}
                </p>
                <div className="space-y-0.5">
                  {data.wholesale.conversations.sms > 0 && (
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <Smartphone className="h-3 w-3" />
                      {data.wholesale.conversations.sms.toLocaleString()} SMS
                    </div>
                  )}
                  {data.wholesale.conversations.phone > 0 && (
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <Phone className="h-3 w-3" />
                      {data.wholesale.conversations.phone.toLocaleString()} Calls
                    </div>
                  )}
                  {data.wholesale.conversations.email > 0 && (
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <Mail className="h-3 w-3" />
                      {data.wholesale.conversations.email.toLocaleString()} Email
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Acquisitions funnel bar */}
            <div className="rounded-xl border border-border/40 bg-card/40 p-4">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-3">
                Acquisitions Funnel <span className="normal-case font-normal">(current pipeline state)</span>
              </p>
              {(() => {
                const f = data.wholesale.funnel;
                const max = Math.max(f.newOppsInPeriod, f.offersSubmitted, f.negotiating, f.contractsSigned, f.dealsClosed, 1);
                return (
                  <div className="space-y-1.5">
                    <FunnelBar label="In Pipeline" value={f.newOppsInPeriod} max={max} color="#6366f1" />
                    <FunnelBar label="Offer Submitted" value={f.offersSubmitted} max={max} color="#8b5cf6" />
                    <FunnelBar label="Negotiating" value={f.negotiating} max={max} color="#a855f7" />
                    <FunnelBar label="Contract Signed" value={f.contractsSigned} max={max} color="#10b981" />
                    <FunnelBar label="Closed – Won" value={f.dealsClosed} max={max} color="#059669" />
                  </div>
                );
              })()}
            </div>
          </section>

          {/* ── Portfolio ──────────────────────────────────── */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="h-3.5 w-3.5 text-primary" />
              <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Portfolio — {data.periodLabel}
              </h4>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
              <KpiTile
                label="New Deals"
                value={data.portfolio.newDealsInPeriod}
                icon={Users}
                accent
                sub={period === 'all' ? 'Total in pipeline' : `Created ${data.periodLabel.toLowerCase()}`}
              />
              <KpiTile label="Passed Napkin" value={data.portfolio.funnel.passedNapkin} icon={FileText}
                sub="Current in UW+" />
              <KpiTile label="Offer Sent (LOI)" value={data.portfolio.funnel.offerSent} icon={PenLine} />
              <KpiTile label="Closed Won" value={data.portfolio.funnel.dealsClosed} icon={CheckCircle} accent />
            </div>

            <div className="rounded-xl border border-border/40 bg-card/40 p-4">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-3">
                Portfolio Funnel <span className="normal-case font-normal">(current pipeline state)</span>
              </p>
              {(() => {
                const f = data.portfolio.funnel;
                const tot = data.portfolio.newDealsInPeriod || 1;
                const max = Math.max(tot, f.newAndGathering, f.passedNapkin, f.offerSent, f.dealsClosed, 1);
                return (
                  <div className="space-y-1.5">
                    <FunnelBar label="In Pipeline" value={tot} max={max} color="#6366f1" />
                    <FunnelBar label="New / Gathering Info" value={f.newAndGathering} max={max} color="#8b5cf6" />
                    <FunnelBar label="Passed Napkin / UW" value={f.passedNapkin} max={max} color="#a855f7" />
                    <FunnelBar label="LOI / Negotiating" value={f.offerSent} max={max} color="#f59e0b" />
                    <FunnelBar label="Closed – Won" value={f.dealsClosed} max={max} color="#059669" />
                  </div>
                );
              })()}
            </div>
          </section>

          {/* Lead Status note */}
          <div className="rounded-lg border border-amber-200/40 bg-amber-50/10 dark:bg-amber-950/10 p-3">
            <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80 leading-relaxed">
              <strong>Replied / Lead Status tracking:</strong> GHL's API doesn't support filtering contacts by custom field values.
              The quickest fix: add a <code className="text-[10px] bg-muted/60 px-1 rounded">ls-cold-replied</code> <strong>tag</strong> to your
              V2 Imported Leads workflow at the same step where it sets Lead Status → "Cold - Replied".
              Once that tag exists, it'll auto-populate here.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
