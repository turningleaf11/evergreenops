import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, Loader2, TrendingUp, Users, MessageSquare, FileText, PenLine, CheckCircle, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type GhlKpis = {
  period: string;
  generatedAt: string;
  wholesale: {
    leadsBySource: { tag: string; count: number }[];
    leadsImported: number;
    coldReplied: number;
    conversations: number;
    funnel: {
      acqTotal: number;
      offersSubmitted: number;
      negotiating: number;
      contractsSigned: number;
      dealsClosed: number;
    };
  };
  portfolio: {
    total: number;
    funnel: {
      newDeal: number;
      passedNapkin: number;
      offerSent: number;
      dealsClosed: number;
    };
  };
};

function KpiTile({
  label,
  value,
  icon: Icon,
  accent = false,
  sub,
}: {
  label: string;
  value: number | null;
  icon: React.ElementType;
  accent?: boolean;
  sub?: string;
}) {
  return (
    <div className={cn(
      "rounded-xl border p-4 flex flex-col gap-1.5",
      accent
        ? "border-primary/30 bg-primary/[0.06]"
        : "border-border/50 bg-card/60"
    )}>
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[11px] font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className={cn("text-2xl font-bold tabular-nums", accent ? "text-primary" : "text-foreground")}>
        {value == null ? <span className="text-muted-foreground/40 text-base">—</span> : value.toLocaleString()}
      </p>
      {sub && <p className="text-[10px] text-muted-foreground/60">{sub}</p>}
    </div>
  );
}

function FunnelRow({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="text-xs text-muted-foreground w-36 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-muted/40 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-semibold tabular-nums w-8 text-right">{value}</span>
    </div>
  );
}

function relTime(iso: string): string {
  const diff = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1) return "just now";
  if (diff < 60) return `${diff}m ago`;
  return `${Math.round(diff / 60)}h ago`;
}

const TAG_LABELS: Record<string, string> = {
  "src - imported": "Imported",
  "src - seo": "SEO",
  "src - google ads": "Google Ads",
  "src - offer rocket": "Offer Rocket",
  "src - cold sms": "Cold SMS",
  "src - direct mail": "Direct Mail",
  "src - referral": "Referral",
  "src - cold email": "Cold Email",
  "src - inbound": "Inbound",
};

export function GhlKpiBoard() {
  const [data, setData] = useState<GhlKpis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: result, error: err } = await supabase.functions.invoke("ghl-kpis", {
        body: {},
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

  useEffect(() => { fetch_(); }, [fetch_]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            GHL Live Metrics
          </h3>
          {data?.generatedAt && (
            <p className="text-[11px] text-muted-foreground/60 mt-0.5">
              Updated {relTime(data.generatedAt)}
            </p>
          )}
        </div>
        <Button
          size="icon"
          variant="ghost"
          onClick={fetch_}
          disabled={loading}
          className="h-7 w-7"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
          {error}
        </div>
      )}

      {loading && !data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-muted/40 animate-pulse" />
          ))}
        </div>
      )}

      {data && (
        <>
          {/* ── Wholesale ────────────────────────────── */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-3.5 w-3.5 text-primary" />
              <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Wholesale Team</h4>
            </div>

            {/* KPI tiles */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-3 mb-4">
              <KpiTile label="Leads (Total)" value={data.wholesale.leadsImported} icon={Users} accent />
              <KpiTile label="Replied" value={data.wholesale.coldReplied || null} icon={MessageSquare}
                sub={data.wholesale.coldReplied === 0 ? "Tag 'cold - replied' not yet in use" : undefined} />
              <KpiTile label="Conversations" value={data.wholesale.conversations} icon={MessageSquare} />
              <KpiTile label="Offers Out" value={data.wholesale.funnel.offersSubmitted} icon={FileText} />
              <KpiTile label="Contracts" value={data.wholesale.funnel.contractsSigned} icon={PenLine} />
              <KpiTile label="Deals Closed" value={data.wholesale.funnel.dealsClosed} icon={CheckCircle} accent />
            </div>

            {/* Acquisition funnel bar */}
            <div className="rounded-xl border border-border/40 bg-card/40 p-4">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-3">Acquisitions Funnel (Current)</p>
              {(() => {
                const max = data.wholesale.funnel.acqTotal || 1;
                return (
                  <div className="space-y-1">
                    <FunnelRow label="Total in Pipeline" value={data.wholesale.funnel.acqTotal} max={max} color="#6366f1" />
                    <FunnelRow label="Offers Submitted" value={data.wholesale.funnel.offersSubmitted} max={max} color="#8b5cf6" />
                    <FunnelRow label="Negotiating" value={data.wholesale.funnel.negotiating} max={max} color="#a855f7" />
                    <FunnelRow label="Contracts Signed" value={data.wholesale.funnel.contractsSigned} max={max} color="#10b981" />
                    <FunnelRow label="Closed – Won" value={data.wholesale.funnel.dealsClosed} max={max} color="#059669" />
                  </div>
                );
              })()}
            </div>

            {/* Source breakdown (only if multiple sources) */}
            {data.wholesale.leadsBySource.length > 0 && (
              <div className="mt-3 rounded-xl border border-border/40 bg-card/40 p-4">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-3">Leads by Source</p>
                <div className="space-y-1.5">
                  {data.wholesale.leadsBySource.map(({ tag, count }) => (
                    <div key={tag} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{TAG_LABELS[tag] ?? tag}</span>
                      <span className="font-semibold tabular-nums">{count.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* ── Portfolio ─────────────────────────────── */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="h-3.5 w-3.5 text-primary" />
              <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Portfolio Team</h4>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <KpiTile label="Deals In" value={data.portfolio.funnel.newDeal} icon={Users} accent />
              <KpiTile label="Passed Napkin" value={data.portfolio.funnel.passedNapkin} icon={FileText} />
              <KpiTile label="Offer Sent (LOI)" value={data.portfolio.funnel.offerSent} icon={PenLine} />
              <KpiTile label="Deals Closed" value={data.portfolio.funnel.dealsClosed} icon={CheckCircle} accent />
            </div>

            <div className="rounded-xl border border-border/40 bg-card/40 p-4">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-3">Portfolio Funnel (Current)</p>
              {(() => {
                const max = data.portfolio.total || 1;
                return (
                  <div className="space-y-1">
                    <FunnelRow label="Total in Pipeline" value={data.portfolio.total} max={max} color="#6366f1" />
                    <FunnelRow label="New / Gathering Info" value={data.portfolio.funnel.newDeal} max={max} color="#8b5cf6" />
                    <FunnelRow label="Passed Napkin / UW" value={data.portfolio.funnel.passedNapkin} max={max} color="#a855f7" />
                    <FunnelRow label="LOI / Negotiation" value={data.portfolio.funnel.offerSent} max={max} color="#f59e0b" />
                    <FunnelRow label="Closed – Won" value={data.portfolio.funnel.dealsClosed} max={max} color="#059669" />
                  </div>
                );
              })()}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
