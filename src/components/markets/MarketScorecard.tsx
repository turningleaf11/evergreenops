import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { StatusPill } from "@/components/primitives/StatusPill";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, AlertTriangle, Bot, User, ChevronRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface Category {
  key: string;
  layer: "foundation" | "operator" | "personal";
  label: string;
  guidance: string;
}

interface Row {
  category: string;
  rating: string | null;
  note: string;
  source: string;
  is_core_red: boolean;
  conflict_flag: boolean;
  conflict_note: string;
  updated_by_kind: "ai" | "human";
  updated_by: string | null;
  updated_at: string;
}

interface MarketDecisionFields {
  decision: string | null;
  decision_why: string;
  decision_next_step: string;
  last_scored_at: string | null;
}

const LAYER_LABEL: Record<string, string> = {
  foundation: "Foundation",
  operator: "Operator",
  personal: "Personal",
};

const RATING_HSL: Record<string, string> = {
  green: "152 65% 42%",
  yellow: "32 92% 52%",
  red: "0 72% 52%",
};

interface Props {
  marketId: string;
  market: MarketDecisionFields;
  onMarketChanged: () => void;
  analyzing: boolean;
  onRunAnalysis: () => void;
}

export function MarketScorecard({ marketId, market, onMarketChanged, analyzing, onRunAnalysis }: Props) {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const layerRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: cats }, { data: r }] = await Promise.all([
      supabase.from("market_scorecard_categories").select("key, layer, label, guidance").order("sort_order"),
      supabase.from("market_scorecard_rows").select("*").eq("market_id", marketId),
    ]);
    setCategories((cats as Category[]) || []);
    const map: Record<string, Row> = {};
    for (const row of (r as Row[]) || []) map[row.category] = row;
    setRows(map);

    const userIds = Array.from(new Set((r || []).map((row: any) => row.updated_by).filter(Boolean)));
    if (userIds.length) {
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds);
      const nameMap: Record<string, string> = {};
      for (const p of (profiles as any[]) || []) nameMap[p.user_id] = p.full_name || "Teammate";
      setNames(nameMap);
    }
    setLoading(false);
  }, [marketId]);

  useEffect(() => { load(); }, [load]);

  const upsertRow = async (category: string, patch: Partial<Row>) => {
    const existing = rows[category];
    const next: Row = {
      category,
      rating: existing?.rating ?? null,
      note: existing?.note ?? "",
      source: existing?.source ?? "",
      is_core_red: existing?.is_core_red ?? false,
      conflict_flag: false, // a human edit resolves any standing conflict
      conflict_note: "",
      updated_by_kind: "human",
      updated_by: user?.id ?? null,
      updated_at: new Date().toISOString(),
      ...patch,
    };
    setRows((prev) => ({ ...prev, [category]: next }));
    const { error } = await supabase.from("market_scorecard_rows").upsert(
      { market_id: marketId, ...next },
      { onConflict: "market_id,category" }
    );
    if (error) toast.error(`Save failed: ${error.message}`);
  };

  const saveDecisionField = async (patch: Partial<MarketDecisionFields>) => {
    const { error } = await supabase.from("markets").update(patch as any).eq("id", marketId);
    if (error) { toast.error(`Save failed: ${error.message}`); return; }
    onMarketChanged();
  };

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  const layers: Array<"foundation" | "operator" | "personal"> = ["foundation", "operator", "personal"];
  const scoredCount = Object.values(rows).filter((r) => r.rating).length;
  const totalCount = categories.length;

  const jumpToLayer = (layer: string) => {
    layerRefs.current[layer]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <StatusPill kind="market" value={market.decision} onChange={(v) => saveDecisionField({ decision: v })} />
              <span className="text-[11px] text-muted-foreground">{scoredCount} of {totalCount} rows scored</span>
            </div>
            {market.last_scored_at && (
              <p className="text-[11px] text-muted-foreground mt-1">
                Last scored {formatDistanceToNow(new Date(market.last_scored_at), { addSuffix: true })}
              </p>
            )}
          </div>
          <Button size="sm" onClick={onRunAnalysis} disabled={analyzing} className="gap-1.5">
            {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Run analysis
          </Button>
        </div>
        <Textarea
          key={`why-${market.decision_why}`}
          defaultValue={market.decision_why}
          onBlur={(e) => { if (e.target.value !== market.decision_why) saveDecisionField({ decision_why: e.target.value }); }}
          placeholder="Why this decision — one or two sentences."
          className="min-h-[44px] text-sm border-0 px-0 shadow-none focus-visible:ring-0 resize-none"
        />
        <Input
          key={`next-${market.decision_next_step}`}
          defaultValue={market.decision_next_step}
          onBlur={(e) => { if (e.target.value !== market.decision_next_step) saveDecisionField({ decision_next_step: e.target.value }); }}
          placeholder="Next step — one concrete action."
          className="h-8 text-sm border-0 px-0 shadow-none focus-visible:ring-0"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {layers.map((layer) => {
          const layerCats = categories.filter((c) => c.layer === layer);
          if (!layerCats.length) return null;
          const layerRows = layerCats.map((c) => rows[c.key]).filter(Boolean) as Row[];
          const greens = layerRows.filter((r) => r.rating === "green").length;
          const yellows = layerRows.filter((r) => r.rating === "yellow").length;
          const reds = layerRows.filter((r) => r.rating === "red").length;
          const coreReds = layerRows.filter((r) => r.is_core_red).length;
          const scored = greens + yellows + reds;

          return (
            <button
              key={layer}
              onClick={() => jumpToLayer(layer)}
              className="text-left rounded-xl border bg-card p-4 hover:border-primary/40 hover:shadow-sm transition-all"
            >
              <div className="flex items-baseline justify-between mb-2.5">
                <span className="font-semibold text-[13px]">{LAYER_LABEL[layer]}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{scored}/{layerCats.length}</span>
              </div>
              <div className="flex h-1.5 rounded-full overflow-hidden bg-muted mb-2.5">
                {greens > 0 && <span style={{ width: `${(greens / layerCats.length) * 100}%`, backgroundColor: `hsl(${RATING_HSL.green})` }} />}
                {yellows > 0 && <span style={{ width: `${(yellows / layerCats.length) * 100}%`, backgroundColor: `hsl(${RATING_HSL.yellow})` }} />}
                {reds > 0 && <span style={{ width: `${(reds / layerCats.length) * 100}%`, backgroundColor: `hsl(${RATING_HSL.red})` }} />}
              </div>
              <p className={cn("text-[11px]", coreReds > 0 ? "text-destructive font-medium" : "text-muted-foreground")}>
                {coreReds > 0 ? `${coreReds} core red${coreReds > 1 ? "s" : ""}` : "No core reds"}
              </p>
            </button>
          );
        })}
      </div>

      {layers.map((layer) => {
        const layerCats = categories.filter((c) => c.layer === layer);
        if (!layerCats.length) return null;
        return (
          <div key={layer} ref={(el) => { layerRefs.current[layer] = el; }} className="space-y-2 scroll-mt-4">
            <p className="crm-eyebrow">{LAYER_LABEL[layer]}</p>
            <div className="rounded-xl border bg-card divide-y">
              {layerCats.map((cat) => {
                const row = rows[cat.key];
                const isOpen = expanded === cat.key;
                return (
                  <div key={cat.key}>
                    <button
                      onClick={() => setExpanded(isOpen ? null : cat.key)}
                      className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left hover:bg-muted/40 transition-colors"
                    >
                      <ChevronRight className={cn("h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform", isOpen && "rotate-90")} />
                      <span className="text-[13px] font-medium w-[190px] shrink-0 truncate">{cat.label}</span>
                      <StatusPill kind="market_rating" value={row?.rating} size="sm" />
                      {row?.is_core_red && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-destructive bg-destructive/10 rounded px-1.5 py-0.5 shrink-0">
                          <AlertTriangle className="h-3 w-3" /> Core red
                        </span>
                      )}
                      {!isOpen && (
                        <span className="text-xs text-muted-foreground truncate flex-1">{row?.note || "Not yet scored."}</span>
                      )}
                    </button>

                    {isOpen && (
                      <div className="px-3.5 pb-3.5 pl-[42px] space-y-2">
                        <p className="text-[11px] text-muted-foreground">{cat.guidance}</p>
                        <div className="flex items-center gap-2">
                          <span className="crm-field-label mb-0 shrink-0">Rating</span>
                          <StatusPill
                            kind="market_rating"
                            value={row?.rating}
                            size="sm"
                            onChange={(v) => upsertRow(cat.key, { rating: v })}
                          />
                        </div>
                        <Textarea
                          key={`note-${cat.key}-${row?.updated_at ?? ""}`}
                          defaultValue={row?.note ?? ""}
                          onBlur={(e) => { if (e.target.value !== (row?.note ?? "")) upsertRow(cat.key, { note: e.target.value }); }}
                          placeholder="Note — the why, not just the number."
                          className="min-h-[44px] text-xs"
                        />
                        <Input
                          key={`source-${cat.key}-${row?.updated_at ?? ""}`}
                          defaultValue={row?.source ?? ""}
                          onBlur={(e) => { if (e.target.value !== (row?.source ?? "")) upsertRow(cat.key, { source: e.target.value }); }}
                          placeholder="Source"
                          className="h-7 text-xs"
                        />
                        {row?.conflict_flag && row.conflict_note && (
                          <div className="flex items-start gap-1.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 px-2 py-1.5 text-[11px]">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                            <span>{row.conflict_note}</span>
                          </div>
                        )}
                        {row && (
                          <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            {row.updated_by_kind === "ai" ? <Bot className="h-3 w-3" /> : <User className="h-3 w-3" />}
                            {row.updated_by_kind === "ai" ? "AI" : names[row.updated_by ?? ""] ?? "Teammate"}
                            {" · "}
                            {formatDistanceToNow(new Date(row.updated_at), { addSuffix: true })}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
