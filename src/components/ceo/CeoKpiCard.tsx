import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Loader2, RefreshCw, ArrowRight, TrendingUp, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PERIODS = [
  { value: "today",      label: "Today" },
  { value: "this_week",  label: "This Week" },
  { value: "last_week",  label: "Last Week" },
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "this_qtr",   label: "This Quarter" },
  { value: "all",        label: "All Time" },
];

type KpiData = {
  wholesale: {
    apptSet: number;
    offersSent: number;
    contractsSigned: number;
    dealsClosed: number;
  };
  portfolio: {
    dealsIn: number;
    passedNapkin: number;
    offersSent: number;
    offersAccepted: number;
  };
  periodLabel: string;
  generatedAt: string;
};

function Tile({
  label, value, accent = false, note,
}: { label: string; value: number; accent?: boolean; note?: string }) {
  return (
    <div className={cn(
      "rounded-xl border p-4 flex flex-col gap-0.5 text-center",
      accent ? "border-primary/30 bg-primary/[0.05]" : "border-border/40 bg-card/40",
    )}>
      <p className={cn(
        "text-3xl font-bold tabular-nums",
        accent ? "text-primary" : "text-foreground",
      )}>
        {value.toLocaleString()}
      </p>
      <p className="text-[11px] font-medium text-muted-foreground leading-tight">{label}</p>
      {note && <p className="text-[10px] text-muted-foreground/50 leading-tight">{note}</p>}
    </div>
  );
}

function relTime(iso: string): string {
  const diff = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1) return "just now";
  if (diff < 60) return `${diff}m ago`;
  return `${Math.round(diff / 60)}h ago`;
}

export function CeoKpiCard() {
  const [period, setPeriod] = useState("this_month");
  const [data, setData] = useState<KpiData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (p: string) => {
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
      const raw = await res.json();
      if (raw?.error) throw new Error(raw.error);

      const ws = raw.wholesale;
      const port = raw.portfolio;
      setData({
        wholesale: {
          apptSet:          ws.dtsFunnel.apptSet,
          offersSent:       ws.dealTags.offerSubmitted,
          contractsSigned:  ws.dealTags.contractSigned,
          dealsClosed:      ws.dealTags.dealClosed,
        },
        portfolio: {
          dealsIn:          port.newDealsInPeriod,
          passedNapkin:     port.funnel.passedNapkin,
          offersSent:       port.funnel.offerSent,
          offersAccepted:   port.funnel.passedNapkin - port.funnel.offerSent, // T2+ minus LOI-stage
        },
        periodLabel: raw.periodLabel,
        generatedAt: raw.generatedAt,
      });
    } catch (e: any) {
      setError(e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(period); }, [period]);

  return (
    <div className="rounded-2xl border border-border/50 bg-card/80 p-6 elevation-1 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">KPI Snapshot</h2>
          {data?.generatedAt && (
            <p className="text-[11px] text-muted-foreground/50 mt-0.5">
              {data.periodLabel} · updated {relTime(data.generatedAt)}
              <span className="ml-1.5 opacity-60">· deal tags all-time</span>
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
          <Button size="icon" variant="ghost" onClick={() => load(period)} disabled={loading} className="h-7 w-7">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      {loading && !data && (
        <div className="grid grid-cols-4 gap-3">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-muted/40 animate-pulse" />
          ))}
        </div>
      )}

      {data && (
        <div className={cn("space-y-4 transition-opacity", loading && "opacity-60 pointer-events-none")}>
          {/* Wholesale */}
          <div>
            <div className="flex items-center gap-1.5 mb-2.5">
              <TrendingUp className="h-3 w-3 text-primary" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Wholesale</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Tile label="Appts Set"         value={data.wholesale.apptSet}         note="ls tag · all-time" />
              <Tile label="Offers Sent"       value={data.wholesale.offersSent}      note="tag · all-time" />
              <Tile label="Contracts Signed"  value={data.wholesale.contractsSigned} note="tag · all-time" />
              <Tile label="Deals Closed"      value={data.wholesale.dealsClosed}     accent note="tag · all-time" />
            </div>
          </div>

          {/* Portfolio */}
          <div>
            <div className="flex items-center gap-1.5 mb-2.5">
              <Building2 className="h-3 w-3 text-primary" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Portfolio</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Tile label="Deals In"       value={data.portfolio.dealsIn}        note={`${data.periodLabel}`} />
              <Tile label="Passed Napkin"  value={data.portfolio.passedNapkin}   note="current pipeline" />
              <Tile label="Offers Sent"    value={data.portfolio.offersSent}     note="current pipeline" />
              <Tile label="Offers Accepted" value={data.portfolio.offersAccepted} accent note="current pipeline" />
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end pt-1">
        <Link
          to="/scorecard"
          className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors font-medium"
        >
          Full scorecard <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
