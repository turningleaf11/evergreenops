import { useEffect, useMemo, useState } from "react";
import { Loader2, Briefcase } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Stage {
  id: string;
  pipeline_id: string;
  name: string;
  sort_order: number;
  color: string;
  is_won: boolean;
  is_lost: boolean;
}

interface Deal {
  id: string;
  title: string;
  stage_id: string;
  pipeline_id: string;
  value: number;
  currency: string;
  status: string;
  primary_contact_id: string | null;
  expected_close_date: string | null;
}

interface Pipeline {
  id: string;
  name: string;
  is_default: boolean;
}

const formatMoney = (n: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);

export function DealsKanban({ search }: { search: string }) {
  const [loading, setLoading] = useState(true);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [activePipelineId, setActivePipelineId] = useState<string | null>(null);
  const [stages, setStages] = useState<Stage[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: pls } = await supabase
        .from("pipelines")
        .select("*")
        .order("sort_order", { ascending: true });
      const list = (pls as Pipeline[]) || [];
      setPipelines(list);
      const def = list.find((p) => p.is_default) || list[0];
      setActivePipelineId(def?.id ?? null);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!activePipelineId) return;
    (async () => {
      const [{ data: st }, { data: dl }] = await Promise.all([
        supabase
          .from("pipeline_stages")
          .select("*")
          .eq("pipeline_id", activePipelineId)
          .order("sort_order", { ascending: true }),
        supabase
          .from("deals")
          .select("*")
          .eq("pipeline_id", activePipelineId)
          .order("created_at", { ascending: false }),
      ]);
      setStages((st as Stage[]) || []);
      setDeals((dl as Deal[]) || []);
    })();
  }, [activePipelineId]);

  const dealsByStage = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q ? deals.filter((d) => d.title.toLowerCase().includes(q)) : deals;
    const map = new Map<string, Deal[]>();
    stages.forEach((s) => map.set(s.id, []));
    filtered.forEach((d) => {
      const arr = map.get(d.stage_id);
      if (arr) arr.push(d);
    });
    return map;
  }, [deals, stages, search]);

  const totals = useMemo(() => {
    const open = deals.filter((d) => d.status === "open");
    const total = open.reduce((sum, d) => sum + Number(d.value || 0), 0);
    const won = deals
      .filter((d) => d.status === "won")
      .reduce((s, d) => s + Number(d.value || 0), 0);
    return { total, won, openCount: open.length };
  }, [deals]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground gap-2 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading deals…
      </div>
    );
  }

  if (!activePipelineId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center text-sm text-muted-foreground">
        <Briefcase className="h-8 w-8 mb-3 opacity-50" />
        <p className="font-medium text-foreground mb-1">No pipelines configured</p>
        <p>An admin needs to create a pipeline first.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      {/* Forecast strip */}
      <div className="flex items-center justify-between rounded-xl border border-border/50 bg-card px-4 py-3 text-sm">
        <div className="flex items-center gap-6">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Open</div>
            <div className="font-semibold">{formatMoney(totals.total)}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Won</div>
            <div className="font-semibold text-emerald-600">{formatMoney(totals.won)}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Open deals</div>
            <div className="font-semibold">{totals.openCount}</div>
          </div>
        </div>
        {pipelines.length > 1 && (
          <select
            value={activePipelineId}
            onChange={(e) => setActivePipelineId(e.target.value)}
            className="text-xs bg-transparent border border-border/50 rounded px-2 py-1"
          >
            {pipelines.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(220px, 1fr))` }}>
        {stages.map((stage) => {
          const items = dealsByStage.get(stage.id) || [];
          const sum = items.reduce((s, d) => s + Number(d.value || 0), 0);
          return (
            <div key={stage.id} className="flex flex-col rounded-xl bg-muted/30 border border-border/30 min-h-[200px]">
              <div className="px-3 py-2 border-b border-border/30 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: `hsl(${stage.color})` }}
                  />
                  <span className="text-xs font-medium truncate">{stage.name}</span>
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">{items.length}</span>
              </div>
              <div className="p-2 space-y-2 flex-1">
                {items.map((d) => (
                  <div
                    key={d.id}
                    className="rounded-lg border border-border/40 bg-card p-2.5 text-xs hover:shadow-sm transition-shadow cursor-pointer"
                  >
                    <p className="font-medium text-sm leading-snug line-clamp-2 mb-1">{d.title}</p>
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>{formatMoney(Number(d.value || 0), d.currency)}</span>
                      {d.expected_close_date && (
                        <span className="text-[10px]">
                          {new Date(d.expected_close_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {items.length === 0 && (
                  <div className="text-[11px] text-muted-foreground/60 text-center py-4">No deals</div>
                )}
              </div>
              {items.length > 0 && (
                <div className="px-3 py-1.5 border-t border-border/30 text-[11px] text-muted-foreground flex justify-between">
                  <span>Total</span>
                  <span className="font-medium text-foreground">{formatMoney(sum)}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
