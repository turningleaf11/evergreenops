import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { StatusPill } from "@/components/primitives/StatusPill";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, AlertTriangle, Bot, User } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

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

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="crm-field-label mb-0">Decision</span>
            <StatusPill kind="market" value={market.decision} onChange={(v) => saveDecisionField({ decision: v })} />
          </div>
          <div className="flex items-center gap-2">
            {market.last_scored_at && (
              <span className="text-[11px] text-muted-foreground">
                Last scored {formatDistanceToNow(new Date(market.last_scored_at), { addSuffix: true })}
              </span>
            )}
            <Button size="sm" onClick={onRunAnalysis} disabled={analyzing} className="gap-1.5">
              {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Run analysis
            </Button>
          </div>
        </div>
        <div>
          <label className="crm-field-label">Why</label>
          <Textarea
            defaultValue={market.decision_why}
            onBlur={(e) => saveDecisionField({ decision_why: e.target.value })}
            placeholder="Why this decision — one or two sentences."
            className="min-h-[50px] text-sm"
          />
        </div>
        <div>
          <label className="crm-field-label">Next step</label>
          <Input
            defaultValue={market.decision_next_step}
            onBlur={(e) => saveDecisionField({ decision_next_step: e.target.value })}
            placeholder="One concrete next action."
          />
        </div>
      </div>

      {layers.map((layer) => {
        const layerCats = categories.filter((c) => c.layer === layer);
        if (!layerCats.length) return null;
        return (
          <div key={layer} className="space-y-2">
            <p className="crm-eyebrow">{LAYER_LABEL[layer]}</p>
            <div className="space-y-2">
              {layerCats.map((cat) => {
                const row = rows[cat.key];
                return (
                  <div key={cat.key} className="rounded-lg border bg-card p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium">{cat.label}</p>
                        <p className="text-[11px] text-muted-foreground">{cat.guidance}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {row?.is_core_red && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-destructive bg-destructive/10 rounded px-1.5 py-0.5">
                            <AlertTriangle className="h-3 w-3" /> Core red
                          </span>
                        )}
                        <StatusPill
                          kind="market_rating"
                          value={row?.rating}
                          size="sm"
                          onChange={(v) => upsertRow(cat.key, { rating: v })}
                        />
                      </div>
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
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
